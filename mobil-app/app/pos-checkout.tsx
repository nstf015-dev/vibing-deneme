import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function POSCheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const appointmentId = params.appointment_id as string | undefined;

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<Array<{ item: any; quantity: number }>>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'card' | 'cash' | 'wallet'>('card');
  const [discount, setDiscount] = useState(0);
  const [discountCode, setDiscountCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch POS items
      const { data: items } = await supabase
        .from('pos_items')
        .select('*')
        .eq('business_id', user.id)
        .eq('is_active', true)
        .order('name');

      setProducts(items || []);

      // If appointment ID provided, fetch appointment details
      if (appointmentId) {
        const { data: appointment } = await supabase
          .from('appointments')
          .select('*, client:profiles!client_id(full_name)')
          .eq('id', appointmentId)
          .single();

        if (appointment) {
          setCustomerName(appointment.client?.full_name || '');
        }
      }
    } catch (error) {
      console.error('POS data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const item = prev.find((c) => c.item.id === itemId);
      if (item && item.quantity > 1) {
        return prev.map((c) =>
          c.item.id === itemId ? { ...c, quantity: c.quantity - 1 } : c
        );
      }
      return prev.filter((c) => c.item.id !== itemId);
    });
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const tax = subtotal * 0.20; // 20% KDV
    return subtotal + tax - discount;
  };

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;

    // TODO: Check discount code from campaigns
    Alert.alert('Bilgi', 'İndirim kodu kontrol ediliyor...');
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      Alert.alert('Uyarı', 'Sepetiniz boş.');
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const total = calculateTotal();
      const items = cart.map((c) => ({
        item_id: c.item.id,
        item_name: c.item.name,
        quantity: c.quantity,
        unit_price: c.item.price,
        total_price: c.item.price * c.quantity,
      }));

      // Create POS sale
      const { data: sale, error: saleError } = await supabase
        .from('pos_sales')
        .insert({
          business_id: user.id,
          customer_id: appointmentId ? (await supabase.from('appointments').select('client_id').eq('id', appointmentId).single()).data?.client_id : null,
          total_amount: total,
          payment_method: selectedPaymentMethod,
          items: items,
          discount_amount: discount,
          tax_amount: calculateSubtotal() * 0.20,
          notes: customerName ? `Müşteri: ${customerName}` : null,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Update stock
      for (const cartItem of cart) {
        if (cartItem.item.stock_quantity !== null) {
          await supabase
            .from('pos_items')
            .update({
              stock_quantity: cartItem.item.stock_quantity - cartItem.quantity,
            })
            .eq('id', cartItem.item.id);
        }
      }

      Alert.alert(
        'Başarılı! 🎉',
        `Satış tamamlandı. Toplam: ${total.toFixed(2)}₺`,
        [
          {
            text: 'Tamam',
            onPress: () => {
              setCart([]);
              setDiscount(0);
              setDiscountCode('');
              if (appointmentId) {
                router.back();
              }
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Satış tamamlanamadı.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && products.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>POS Satış</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        {/* CUSTOMER INFO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Müşteri</Text>
          <TextInput
            style={styles.input}
            placeholder="Müşteri adı (opsiyonel)"
            placeholderTextColor="#666"
            value={customerName}
            onChangeText={setCustomerName}
          />
        </View>

        {/* PRODUCTS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Ürünler</Text>
            <TouchableOpacity
              onPress={() => setShowProductModal(true)}
              style={styles.addButton}>
              <Ionicons name="add-circle" size={24} color="#0095F6" />
            </TouchableOpacity>
          </View>

          {cart.length === 0 ? (
            <View style={styles.emptyCart}>
              <Ionicons name="cart-outline" size={48} color="#666" />
              <Text style={styles.emptyText}>Sepet boş</Text>
            </View>
          ) : (
            <View style={styles.cartList}>
              {cart.map((cartItem) => (
                <View key={cartItem.item.id} style={styles.cartItem}>
                  <View style={styles.cartItemInfo}>
                    <Text style={styles.cartItemName}>{cartItem.item.name}</Text>
                    <Text style={styles.cartItemPrice}>
                      {cartItem.item.price}₺ × {cartItem.quantity} ={' '}
                      {(cartItem.item.price * cartItem.quantity).toFixed(2)}₺
                    </Text>
                  </View>
                  <View style={styles.quantityControls}>
                    <TouchableOpacity
                      onPress={() => removeFromCart(cartItem.item.id)}
                      style={styles.quantityButton}>
                      <Ionicons name="remove" size={20} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.quantity}>{cartItem.quantity}</Text>
                    <TouchableOpacity
                      onPress={() => addToCart(cartItem.item)}
                      style={styles.quantityButton}>
                      <Ionicons name="add" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* DISCOUNT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>İndirim</Text>
          <View style={styles.discountRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginRight: 10 }]}
              placeholder="İndirim kodu"
              placeholderTextColor="#666"
              value={discountCode}
              onChangeText={setDiscountCode}
            />
            <TouchableOpacity
              onPress={handleApplyDiscount}
              style={styles.applyButton}>
              <Text style={styles.applyButtonText}>Uygula</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* PAYMENT METHOD */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ödeme Yöntemi</Text>
          <View style={styles.paymentMethods}>
            {(['card', 'cash', 'wallet'] as const).map((method) => (
              <TouchableOpacity
                key={method}
                style={[
                  styles.paymentMethod,
                  selectedPaymentMethod === method && styles.paymentMethodActive,
                ]}
                onPress={() => setSelectedPaymentMethod(method)}>
                <Ionicons
                  name={
                    method === 'card'
                      ? 'card-outline'
                      : method === 'cash'
                      ? 'cash-outline'
                      : 'wallet-outline'
                  }
                  size={24}
                  color={selectedPaymentMethod === method ? '#000' : '#fff'}
                />
                <Text
                  style={[
                    styles.paymentMethodText,
                    selectedPaymentMethod === method && styles.paymentMethodTextActive,
                  ]}>
                  {method === 'card' ? 'Kart' : method === 'cash' ? 'Nakit' : 'Cüzdan'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* SUMMARY */}
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Ara Toplam</Text>
            <Text style={styles.summaryValue}>{calculateSubtotal().toFixed(2)}₺</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>KDV (20%)</Text>
            <Text style={styles.summaryValue}>{(calculateSubtotal() * 0.20).toFixed(2)}₺</Text>
          </View>
          {discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>İndirim</Text>
              <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
                -{discount.toFixed(2)}₺
              </Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.summaryTotalLabel}>TOPLAM</Text>
            <Text style={styles.summaryTotalValue}>{calculateTotal().toFixed(2)}₺</Text>
          </View>
        </View>
      </View>

      {/* CHECKOUT BUTTON */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.checkoutButton, (cart.length === 0 || loading) && styles.checkoutButtonDisabled]}
          onPress={handleCheckout}
          disabled={cart.length === 0 || loading}>
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.checkoutButtonText}>
              Ödeme Yap ({calculateTotal().toFixed(2)}₺)
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* PRODUCT SELECTION MODAL */}
      <Modal visible={showProductModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ürün Seç</Text>
              <TouchableOpacity onPress={() => setShowProductModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={products}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.productOption}
                  onPress={() => {
                    addToCart(item);
                    setShowProductModal(false);
                  }}>
                  <View style={styles.productOptionInfo}>
                    <Text style={styles.productOptionName}>{item.name}</Text>
                    <Text style={styles.productOptionPrice}>{item.price}₺</Text>
                    {item.stock_quantity !== null && (
                      <Text style={styles.productStock}>
                        Stok: {item.stock_quantity}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="add-circle" size={24} color="#0095F6" />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1, padding: 15 },
  section: { marginBottom: 25 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  input: {
    backgroundColor: '#1E1E1E',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  addButton: { padding: 5 },
  emptyCart: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#666', marginTop: 16 },
  cartList: { gap: 12 },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  cartItemInfo: { flex: 1 },
  cartItemName: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cartItemPrice: { color: '#888', fontSize: 14 },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    backgroundColor: '#0095F6',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantity: { color: '#fff', fontSize: 16, fontWeight: 'bold', minWidth: 30, textAlign: 'center' },
  discountRow: { flexDirection: 'row', alignItems: 'center' },
  applyButton: {
    backgroundColor: '#0095F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  applyButtonText: { color: '#000', fontWeight: 'bold' },
  paymentMethods: { flexDirection: 'row', gap: 12 },
  paymentMethod: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  paymentMethodActive: { backgroundColor: '#0095F6', borderColor: '#0095F6' },
  paymentMethodText: { color: '#fff', marginTop: 8, fontSize: 12 },
  paymentMethodTextActive: { color: '#000', fontWeight: 'bold' },
  summary: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: { color: '#888', fontSize: 14 },
  summaryValue: { color: '#fff', fontSize: 14 },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 12,
    marginTop: 8,
  },
  summaryTotalLabel: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  summaryTotalValue: { color: '#4CAF50', fontSize: 24, fontWeight: 'bold' },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: '#000',
  },
  checkoutButton: {
    backgroundColor: '#0095F6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkoutButtonDisabled: { backgroundColor: '#333', opacity: 0.5 },
  checkoutButtonText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  productOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  productOptionInfo: { flex: 1 },
  productOptionName: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  productOptionPrice: { color: '#4CAF50', fontSize: 16, fontWeight: 'bold' },
  productStock: { color: '#888', fontSize: 12, marginTop: 4 },
});

