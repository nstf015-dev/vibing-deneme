import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

// --- 1. İŞLETME PRESETLERİ ---
const BUSINESS_DATA = {
  berber: {
    name: 'Berber',
    icon: 'cut',
    defaultServices: [{ name: 'Saç Kesimi', price: '300₺', duration: '30' }, { name: 'Sakal Tıraşı', price: '150₺', duration: '20' }, { name: 'Saç & Sakal', price: '400₺', duration: '50' }],
    resourceTypes: ['Traş Koltuğu', 'Yıkama Ünitesi', 'VIP Oda', 'Çocuk Koltuğu'],
    staffRoles: ['Usta', 'Kalfa', 'Çırak'],
    defaultSkills: ['Saç Kesim', 'Sakal', 'Yıkama', 'Ağda', 'Maske']
  },
  kuafor: {
    name: 'Kuaför',
    icon: 'woman',
    defaultServices: [{ name: 'Kesim', price: '500₺', duration: '45' }, { name: 'Boya', price: '1500₺', duration: '120' }, { name: 'Fön', price: '200₺', duration: '30' }, { name: 'Gelin Başı', price: '3000₺', duration: '180' }],
    resourceTypes: ['Kesim Koltuğu', 'Makyaj Masası', 'Ağda Odası', 'Solaryum'],
    staffRoles: ['Saç Uzmanı', 'Makyaj Artisti', 'Manikürist', 'Asistan'],
    defaultSkills: ['Kesim', 'Boya', 'Fön', 'Topuz', 'Makyaj', 'Manikür']
  },
  guzellik: {
    name: 'Güzellik Merkezi',
    icon: 'sparkles',
    defaultServices: [{ name: 'Lazer Epilasyon', price: '1000₺', duration: '45' }, { name: 'Cilt Bakımı', price: '800₺', duration: '60' }],
    resourceTypes: ['Buz Lazer Cihazı', 'Alexandrite Cihazı', 'Cilt Bakım Odası'],
    staffRoles: ['Güzellik Uzmanı', 'Estetisyen', 'Diyetisyen'],
    defaultSkills: ['Lazer', 'Cilt Bakımı', 'Zayıflama', 'Masaj']
  },
  spa: {
    name: 'Spa & Masaj',
    icon: 'water',
    defaultServices: [{ name: 'Bali Masajı', price: '1200₺', duration: '60' }, { name: 'Klasik Masaj', price: '1000₺', duration: '60' }, { name: 'Hamam', price: '800₺', duration: '45' }],
    resourceTypes: ['Masaj Odası (Tek)', 'Masaj Odası (Çift)', 'Sauna', 'Kurna'],
    staffRoles: ['Masaj Terapisti', 'Tellak/Natır', 'Resepsiyon'],
    defaultSkills: ['Klasik Masaj', 'Thai Masaj', 'Kese/Köpük']
  }
};

const INITIAL_SCHEDULE = [
  { day: 'Pazartesi', isOpen: true, start: '09:00', end: '21:00' },
  { day: 'Salı', isOpen: true, start: '09:00', end: '21:00' },
  { day: 'Çarşamba', isOpen: true, start: '09:00', end: '21:00' },
  { day: 'Perşembe', isOpen: true, start: '09:00', end: '21:00' },
  { day: 'Cuma', isOpen: true, start: '09:00', end: '21:00' },
  { day: 'Cumartesi', isOpen: true, start: '10:00', end: '22:00' },
  { day: 'Pazar', isOpen: false, start: '10:00', end: '18:00' },
];

export default function WizardScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1); 
  const [loading, setLoading] = useState(true); // Başlangıçta yükleniyor

  // --- STATE ---
  const [selectedTypeKey, setSelectedTypeKey] = useState<string | null>(null);
  
  // Listeler
  const [resourcesList, setResourcesList] = useState<{name: string, count: number}[]>([]);
  const [staffList, setStaffList] = useState<{role: string, name: string, skills: string[]}[]>([]);
  
  const [availableSkills, setAvailableSkills] = useState<string[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [schedule, setSchedule] = useState(INITIAL_SCHEDULE);

  // Inputlar
  const [customResourceName, setCustomResourceName] = useState('');
  const [customSkillName, setCustomSkillName] = useState('');
  
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServicePrice, setCustomServicePrice] = useState('');
  const [customServiceDuration, setCustomServiceDuration] = useState('');

  // Modallar
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);

  const [totalStaffCount, setTotalStaffCount] = useState(0);

  useEffect(() => {
    setTotalStaffCount(staffList.length);
  }, [staffList]);

  // --- VERİLERİ GERİ YÜKLEME (MEMORY FETCH) ---
  const loadExistingData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      let resolvedTypeKey: keyof typeof BUSINESS_DATA | null = null;

      // 1. PROFİL (İşletme Türü ve Saatler)
      const { data: profile } = await supabase.from('profiles').select('business_type, working_hours').eq('id', user.id).single();
      
      // İşletme türünü bul
      if (profile?.business_type) {
        const typeKey = Object.keys(BUSINESS_DATA).find(key => BUSINESS_DATA[key as keyof typeof BUSINESS_DATA].name === profile.business_type);
        if (typeKey) {
          resolvedTypeKey = typeKey as keyof typeof BUSINESS_DATA;
          setSelectedTypeKey(typeKey);
          setAvailableSkills(BUSINESS_DATA[resolvedTypeKey].defaultSkills || []);
        }
      }
      
      // Saatleri yükle
      if (profile?.working_hours) {
        setSchedule(profile.working_hours);
      }

      // 2. HİZMETLERİ YÜKLE
      const { data: fetchedServices } = await supabase.from('business_services').select('*').eq('business_id', user.id);
      if (fetchedServices && fetchedServices.length > 0) {
        const mappedServices = fetchedServices.map(s => ({
          name: s.name,
          price: s.price,
          duration: s.duration.toString(),
          selected: true,
          requiredResources: s.required_resources || [],
          requiredSkills: s.required_staff_roles || []
        }));
        setServices(mappedServices);
      } else if (resolvedTypeKey) {
          // Kayıt yoksa default yükle
          const typeData = BUSINESS_DATA[resolvedTypeKey];
          setServices(typeData.defaultServices.map(s => ({ ...s, selected: true, requiredResources: [], requiredSkills: [] })));
      }

      // 3. PERSONELİ YÜKLE
      const { data: fetchedStaff } = await supabase.from('staff').select('*').eq('business_id', user.id);
      if (fetchedStaff && fetchedStaff.length > 0) {
        const mappedStaff = fetchedStaff.map(s => ({
          name: s.full_name,
          role: s.specialty || 'Personel',
          skills: s.skills || []
        }));
        setStaffList(mappedStaff);
      }

      // 4. KAYNAKLARI YÜKLE VE GRUPLA (Örn: "Koltuk 1", "Koltuk 2" -> "Koltuk: 2")
      const { data: fetchedResources } = await supabase.from('resources').select('*').eq('business_id', user.id);
      if (fetchedResources && fetchedResources.length > 0) {
        const groupedResources: { [key: string]: number } = {};
        fetchedResources.forEach(r => {
          // Sondaki sayıyı temizle ("Traş Koltuğu 1" -> "Traş Koltuğu")
          const baseName = r.name.replace(/\s\d+$/, '');
          groupedResources[baseName] = (groupedResources[baseName] || 0) + 1;
        });

        const mappedResources = Object.keys(groupedResources).map(name => ({
          name: name,
          count: groupedResources[name]
        }));
        setResourcesList(mappedResources);
      }

    } catch (error) {
      console.error("Veri yükleme hatası:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExistingData();
  }, [loadExistingData]);

  const notify = (title: string, message: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n${message}`);
    else Alert.alert(title, message);
  };

  // STEP 1
  const handleTypeSelect = (key: string) => {
    setSelectedTypeKey(key);
    const typeData = BUSINESS_DATA[key as keyof typeof BUSINESS_DATA];
    
    // Eğer zaten hizmetler yüklü geldiyse (DB'den), onları ezme
    if (services.length === 0) {
      setServices(typeData.defaultServices.map(s => ({ ...s, selected: true, requiredResources: [], requiredSkills: [] })));
    }
    setAvailableSkills(typeData.defaultSkills || []);
    
    // Eğer kaynaklar boşsa default ekle
    if (resourcesList.length === 0) {
       setResourcesList([{ name: typeData.resourceTypes[0], count: 1 }]);
    }
    // Eğer personel boşsa default ekle
    if (staffList.length === 0) {
       setStaffList([{ role: typeData.staffRoles[0], name: '', skills: [...(typeData.defaultSkills || [])] }]); 
    }
    
    setStep(2);
  };

  // YÖNETİM
  const addResource = (name: string) => {
    const exists = resourcesList.find(r => r.name === name);
    if (exists) setResourcesList(resourcesList.map(r => r.name === name ? { ...r, count: r.count + 1 } : r));
    else setResourcesList([...resourcesList, { name, count: 1 }]);
    setShowResourceModal(false); setCustomResourceName('');
  };
  const updateResourceCount = (index: number, delta: number) => {
    const nl = [...resourcesList]; nl[index].count += delta;
    if (nl[index].count <= 0) nl.splice(index, 1); setResourcesList(nl);
  };

  const addStaff = (role: string) => {
    setStaffList([...staffList, { role, name: '', skills: [...availableSkills] }]);
    setShowStaffModal(false);
  };
  const removeStaff = (index: number) => { 
    const staffName = staffList[index].name || 'Bu personeli';
    if (Platform.OS === 'web') {
        if (confirm(`${staffName} silinsin mi?`)) { const nl = [...staffList]; nl.splice(index, 1); setStaffList(nl); } 
    } else {
        Alert.alert('Sil', `${staffName} silinsin mi?`, [{ text: 'İptal' }, { text: 'Sil', onPress: () => { const nl = [...staffList]; nl.splice(index, 1); setStaffList(nl); } }]); 
    }
  };
  const updateStaffName = (index: number, t: string) => { const nl = [...staffList]; nl[index].name = t; setStaffList(nl); };

  const toggleStaffSkill = (staffIndex: number, skill: string) => {
    const newStaffList = [...staffList];
    const currentSkills = newStaffList[staffIndex].skills || [];
    if (currentSkills.includes(skill)) newStaffList[staffIndex].skills = currentSkills.filter(s => s !== skill);
    else newStaffList[staffIndex].skills.push(skill);
    setStaffList(newStaffList);
  };

  const addNewSkillToPool = () => {
    if (!customSkillName.trim()) return;
    if (!availableSkills.includes(customSkillName)) setAvailableSkills([...availableSkills, customSkillName]);
    setCustomSkillName('');
  };

  const toggleService = (index: number) => { const ns = [...services]; ns[index].selected = !ns[index].selected; setServices(ns); };
  const updatePrice = (index: number, t: string) => { const ns = [...services]; ns[index].price = t; setServices(ns); };
  const updateDuration = (index: number, t: string) => { const ns = [...services]; ns[index].duration = t; setServices(ns); };

  const addCustomService = () => {
    if (!customServiceName || !customServicePrice || !customServiceDuration) { notify('Eksik', 'Bilgileri giriniz.'); return; }
    setServices([...services, { name: customServiceName, price: customServicePrice, duration: customServiceDuration, selected: true, requiredResources: [], requiredSkills: [] }]);
    setCustomServiceName(''); setCustomServicePrice(''); setCustomServiceDuration('');
  };

  const openMappingModal = (index: number) => { setEditingServiceIndex(index); setShowMappingModal(true); };
  const saveMapping = (resource: string | null | undefined, skill: string | null | undefined) => {
    if (editingServiceIndex !== null) {
      const ns = [...services];
      if (resource !== undefined) {
        const current = ns[editingServiceIndex].requiredResources || [];
        if (resource === null) {
          ns[editingServiceIndex].requiredResources = [];
        } else if (current.includes(resource)) {
          ns[editingServiceIndex].requiredResources = current.filter((r:string) => r !== resource);
        } else {
          ns[editingServiceIndex].requiredResources = [...current, resource];
        }
      }
      if (skill !== undefined) {
        const current = ns[editingServiceIndex].requiredSkills || [];
        if (skill === null) {
          ns[editingServiceIndex].requiredSkills = [];
        } else if (current.includes(skill)) {
          ns[editingServiceIndex].requiredSkills = current.filter((s:string) => s !== skill);
        } else {
          ns[editingServiceIndex].requiredSkills = [...current, skill];
        }
      }
      setServices(ns);
    }
  };

  const updateSchedule = (index: number, field: string, value: any) => { const ns = [...schedule]; ns[index] = { ...ns[index], [field]: value }; setSchedule(ns); };

  // --- FİNAL: KAYDET ---
  const finishSetup = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Giriş yapmamışsınız.');

      if (staffList.some(s => !s.name.trim())) throw new Error('Lütfen tüm personel isimlerini giriniz.');

      // Veriyi temizle (Circular Error Önlemi)
      const cleanSchedule = JSON.parse(JSON.stringify(schedule));
      
      await supabase.from('profiles').update({
        business_type: BUSINESS_DATA[selectedTypeKey as keyof typeof BUSINESS_DATA]?.name || 'İşletme',
        working_hours: cleanSchedule,
        opening_time: cleanSchedule[0].start,
        closing_time: cleanSchedule[0].end,
      }).eq('id', user.id);

      // Temizlik (Cascade ile alt veriler de silinir)
      await supabase.from('business_services').delete().eq('business_id', user.id);
      await supabase.from('resources').delete().eq('business_id', user.id);
      await supabase.from('staff').delete().eq('business_id', user.id);

      const servicesToInsert = services.filter(s => s.selected).map(s => ({
        business_id: user.id, name: s.name, price: s.price, duration: parseInt(s.duration) || 30,
        required_resources: s.requiredResources || [], required_staff_roles: s.requiredSkills || []
      }));
      if (servicesToInsert.length > 0) await supabase.from('business_services').insert(servicesToInsert);

      const resourcesToInsert: any[] = [];
      resourcesList.forEach(res => {
        for (let i = 1; i <= res.count; i++) {
          resourcesToInsert.push({
            business_id: user.id,
            name: `${res.name} ${i}`, // Veritabanına "Koltuk 1, Koltuk 2" diye açılır
            type: 'facility'
          });
        }
      });
      if (resourcesToInsert.length > 0) await supabase.from('resources').insert(resourcesToInsert);

      const staffToInsert = staffList.map((staff) => ({
        business_id: user.id, full_name: staff.name, specialty: staff.role, skills: staff.skills,
        avatar_url: `https://ui-avatars.com/api/?name=${staff.name}&background=random`
      }));
      if (staffToInsert.length > 0) await supabase.from('staff').insert(staffToInsert);

      if (Platform.OS === 'web') {
        if (confirm('Güncelleme Tamamlandı! Profil sayfasına gidilsin mi?')) router.replace('/(tabs)/profile');
      } else {
        Alert.alert('Başarılı', 'Güncelleme tamamlandı.', [{ text: 'Git', onPress: () => setTimeout(() => router.replace('/(tabs)/profile'), 100) }]);
      }

    } catch (error: any) {
      notify('Hata', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#fff"/></View>;

  // --- RENDER ---
  const renderStep1 = () => (
    <View>
      <Text style={styles.headerText}>İşletmeni Tanımla 🏪</Text>
      <View style={styles.grid}>{Object.entries(BUSINESS_DATA).map(([key, data]) => (<TouchableOpacity key={key} style={[styles.card, selectedTypeKey === key && styles.selectedCard]} onPress={() => handleTypeSelect(key)}><View style={styles.iconCircle}><Ionicons name={data.icon as any} size={32} color="#000" /></View><Text style={styles.cardText}>{data.name}</Text></TouchableOpacity>))}</View>
    </View>
  );

  const renderStep2 = () => {
    const currentData = BUSINESS_DATA[selectedTypeKey as keyof typeof BUSINESS_DATA];
    return (
      <View>
        <Text style={styles.headerText}>Ekip ve Envanter 🛠️</Text>
        
        <View style={styles.totalStaffBox}><Text style={styles.totalLabel}>Toplam Ekip:</Text><Text style={styles.totalValue}>{totalStaffCount} Kişi</Text></View>
        <Text style={styles.sectionTitle}>👥 Ekip Üyeleri</Text>
        {staffList.map((staff, index) => (
          <View key={index} style={styles.staffCard}>
            <View style={styles.inputRowNoBg}>
              <Ionicons name="person-circle" size={30} color="#fff" /><TextInput style={styles.nameInput} placeholder="Personel Adı" placeholderTextColor="#666" value={staff.name} onChangeText={(t) => updateStaffName(index, t)}/><TouchableOpacity onPress={() => removeStaff(index)}><Ionicons name="trash-outline" size={20} color="#F44336" /></TouchableOpacity>
            </View>
            <Text style={styles.tinyLabel}>Yetenekler:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 5}}>
              {availableSkills.map((skill, i) => {
                const hasSkill = staff.skills?.includes(skill);
                return (<TouchableOpacity key={i} style={[styles.skillChip, hasSkill ? styles.skillChipActive : styles.skillChipInactive]} onPress={() => toggleStaffSkill(index, skill)}><Text style={[styles.skillText, hasSkill && {color:'#000'}]}>{skill}</Text></TouchableOpacity>)
              })}
            </ScrollView>
          </View>
        ))}
        <View style={styles.addSkillRow}><TextInput style={styles.skillInput} placeholder="+ Özel Yetenek" placeholderTextColor="#666" value={customSkillName} onChangeText={setCustomSkillName}/><TouchableOpacity style={styles.addSkillBtn} onPress={addNewSkillToPool}><Text style={{color:'#000', fontWeight:'bold'}}>Ekle</Text></TouchableOpacity></View>
        <TouchableOpacity style={styles.dashedBtn} onPress={() => setShowStaffModal(true)}><Text style={styles.dashedText}>+ Personel Ekle</Text></TouchableOpacity>

        <Text style={[styles.sectionTitle, {marginTop:20}]}>🪑 Mekan & Cihazlar</Text>
        {resourcesList.map((res, index) => (
          <View key={index} style={styles.counterRow}>
            <Text style={styles.rowLabel}>{res.name}</Text>
            <View style={styles.counterControls}><TouchableOpacity onPress={() => updateResourceCount(index, -1)} style={styles.cntBtn}><Ionicons name="remove" size={20} color="#fff"/></TouchableOpacity><Text style={styles.cntValue}>{res.count}</Text><TouchableOpacity onPress={() => updateResourceCount(index, 1)} style={styles.cntBtn}><Ionicons name="add" size={20} color="#fff"/></TouchableOpacity></View>
          </View>
        ))}
        <TouchableOpacity style={styles.dashedBtn} onPress={() => setShowResourceModal(true)}><Text style={styles.dashedText}>+ Kaynak Ekle</Text></TouchableOpacity>

        <Modal visible={showStaffModal} transparent animationType="slide"><View style={styles.modalOverlay}><View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pozisyon Seç</Text>{currentData?.staffRoles.map(role => (<TouchableOpacity key={role} style={styles.modalItem} onPress={() => addStaff(role)}><Text style={styles.modalItemText}>{role}</Text><Ionicons name="add-circle-outline" size={24} color="#fff"/></TouchableOpacity>))}<TouchableOpacity style={styles.closeBtn} onPress={() => setShowStaffModal(false)}><Text style={{color:'#000'}}>Kapat</Text></TouchableOpacity>
        </View></View></Modal>
        <Modal visible={showResourceModal} transparent animationType="slide"><View style={styles.modalOverlay}><View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Kaynak Tipi Seç</Text>{currentData?.resourceTypes.map(type => (<TouchableOpacity key={type} style={styles.modalItem} onPress={() => addResource(type)}><Text style={styles.modalItemText}>{type}</Text><Ionicons name="add-circle-outline" size={24} color="#fff"/></TouchableOpacity>))}<View style={styles.customInputRow}><TextInput style={styles.customInput} placeholder="Örn: Çocuk Koltuğu" placeholderTextColor="#666" value={customResourceName} onChangeText={setCustomResourceName} /><TouchableOpacity style={styles.addBtnSmall} onPress={() => { if(customResourceName) addResource(customResourceName); }}><Ionicons name="arrow-forward" size={20} color="#000"/></TouchableOpacity></View><TouchableOpacity style={styles.closeBtn} onPress={() => setShowResourceModal(false)}><Text style={{color:'#000'}}>Kapat</Text></TouchableOpacity>
        </View></View></Modal>
        <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(3)}><Text style={styles.nextBtnText}>Devam Et</Text><Ionicons name="arrow-forward" size={20} color="#000" /></TouchableOpacity>
      </View>
    );
  };

  const renderStep3 = () => (
    <View>
      <Text style={styles.headerText}>Hizmet Eşleştirme 🧩</Text>
      <Text style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>Süreyi ve gereksinimleri ayarla.</Text>
      {services.map((service, index) => (
        <View key={index} style={[styles.rowItem, !service.selected && {opacity: 0.5}]}>
          <View style={styles.topRow}>
            <TouchableOpacity onPress={() => toggleService(index)} style={styles.checkCircle}>{service.selected && <Ionicons name="checkmark" size={16} color="#000" />}</TouchableOpacity>
            <Text style={styles.rowText}>{service.name}</Text>
            {service.selected && (<View style={{flexDirection:'row', gap: 5}}><TextInput style={styles.miniInput} value={service.price} onChangeText={t => updatePrice(index, t)} placeholder="₺" placeholderTextColor="#666"/><View style={styles.durationWrapper}><TextInput style={styles.miniInputTime} value={service.duration} onChangeText={t => updateDuration(index, t)} keyboardType="numeric" placeholder="dk" placeholderTextColor="#666"/><Text style={styles.unitText}>dk</Text></View></View>)}
          </View>
          {service.selected && (
            <View style={styles.mappingRow}>
              <TouchableOpacity style={styles.mapBadge} onPress={() => openMappingModal(index)}><Ionicons name="briefcase-outline" size={14} color="#fff" /><Text style={styles.mapText}>{service.requiredSkills?.length > 0 ? service.requiredSkills.join(', ') : 'Herkes'}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.mapBadge} onPress={() => openMappingModal(index)}><Ionicons name="cube-outline" size={14} color="#fff" /><Text style={styles.mapText}>{service.requiredResources?.length > 0 ? service.requiredResources.join(', ') : 'Farketmez'}</Text></TouchableOpacity>
            </View>
          )}
        </View>
      ))}
      <View style={styles.addBox}>
        <TextInput style={[styles.addInput, {flex:2}]} placeholder="Özel Hizmet" placeholderTextColor="#666" value={customServiceName} onChangeText={setCustomServiceName}/>
        <TextInput style={[styles.addInput, {flex:1}]} placeholder="₺" placeholderTextColor="#666" value={customServicePrice} onChangeText={setCustomServicePrice}/>
        <TextInput style={[styles.addInput, {flex:1}]} placeholder="Dk" placeholderTextColor="#666" keyboardType="numeric" value={customServiceDuration} onChangeText={setCustomServiceDuration}/>
        <TouchableOpacity style={styles.addBtn} onPress={addCustomService}><Ionicons name="add" size={24} color="#000"/></TouchableOpacity>
      </View>

      <Modal visible={showMappingModal} transparent animationType="fade"><View style={styles.modalOverlay}><View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Gereksinimler</Text><Text style={styles.sectionTitle}>Yeteneğe Göre</Text><ScrollView horizontal style={{marginBottom:15}}><TouchableOpacity style={[styles.chip, {backgroundColor:'#333'}]} onPress={() => saveMapping(undefined, null)}><Text style={{color:'#fff'}}>Herkes</Text></TouchableOpacity>{availableSkills.map((skill, i) => (<TouchableOpacity key={i} style={styles.chip} onPress={() => saveMapping(undefined, skill)}><Text style={{color:'#000'}}>{skill}</Text></TouchableOpacity>))}</ScrollView><Text style={styles.sectionTitle}>Mekana Göre</Text><ScrollView horizontal><TouchableOpacity style={[styles.chip, {backgroundColor:'#333'}]} onPress={() => saveMapping(null, undefined)}><Text style={{color:'#fff'}}>Farketmez</Text></TouchableOpacity>{resourcesList.map((r, i) => (<TouchableOpacity key={i} style={styles.chip} onPress={() => saveMapping(r.name, undefined)}><Text style={{color:'#000'}}>{r.name}</Text></TouchableOpacity>))}</ScrollView><TouchableOpacity style={styles.closeBtn} onPress={() => setShowMappingModal(false)}><Text style={{color:'#000'}}>Tamam</Text></TouchableOpacity>
      </View></View></Modal>
      <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(4)}><Text style={styles.nextBtnText}>Devam Et</Text><Ionicons name="arrow-forward" size={20} color="#000" /></TouchableOpacity>
    </View>
  );

  const renderStep4 = () => (
    <View>
      <Text style={styles.headerText}>Saatler 📅</Text>
      {schedule.map((item, index) => (
        <View key={index} style={[styles.scheduleRow, !item.isOpen && {opacity:0.5}]}>
          <View style={{flexDirection:'row', alignItems:'center', flex:1}}><Switch value={item.isOpen} onValueChange={(val) => updateSchedule(index, 'isOpen', val)} trackColor={{false:"#333", true:"#4CAF50"}} /><Text style={[styles.dayText, item.isOpen ? {color:'#fff'} : {color:'#666'}]}>{item.day}</Text></View>
          {item.isOpen ? (<View style={{flexDirection:'row', gap:10}}><TextInput style={styles.hourInput} value={item.start} onChangeText={(t)=>updateSchedule(index,'start',t)}/><Text style={{color:'#666', alignSelf:'center'}}>-</Text><TextInput style={styles.hourInput} value={item.end} onChangeText={(t)=>updateSchedule(index,'end',t)}/></View>) : <Text style={{color:'#F44336', fontWeight:'bold'}}>KAPALI</Text>}
        </View>
      ))}
      <TouchableOpacity style={styles.finishBtn} onPress={finishSetup} disabled={loading}><Text style={styles.finishBtnText}>Kaydet ve Bitir 🎉</Text></TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex:1}}>
        <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${step * 25}%` }]} /></View>
        <View style={styles.header}>
          {step > 1 && <TouchableOpacity onPress={() => setStep(step - 1)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>}
          <TouchableOpacity onPress={() => router.back()}><Text style={styles.cancelText}>İptal</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>{step === 1 && renderStep1()}{step === 2 && renderStep2()}{step === 3 && renderStep3()}{step === 4 && renderStep4()}</ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  progressBar: { height: 4, backgroundColor: '#222', width: '100%' },
  progressFill: { height: '100%', backgroundColor: '#4CAF50' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20 },
  cancelText: { color: '#666', fontSize: 16 },
  content: { padding: 20, paddingBottom: 50 },
  headerText: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48%', backgroundColor: '#1E1E1E', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  selectedCard: { borderColor: '#0095F6', borderWidth: 2 },
  iconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  cardText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  totalStaffBox: { backgroundColor: '#0095F6', padding: 15, borderRadius: 12, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  totalValue: { color: '#fff', fontWeight: '900', fontSize: 20 },
  sectionTitle: { color: '#0095F6', fontSize: 16, fontWeight: 'bold', marginBottom: 10, marginTop: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1E1E', padding: 10, borderRadius: 10, marginBottom: 10, gap: 10 },
  inputRowNoBg: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  badge: { backgroundColor: '#333', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5 },
  badgeText: { color: '#aaa', fontSize: 12 },
  nameInput: { flex: 1, color: '#fff', fontSize: 16, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 5 },
  dashedBtn: { borderStyle: 'dashed', borderWidth: 1, borderColor: '#666', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  dashedText: { color: '#888', fontWeight: '600' },
  customInputRow: { flexDirection: 'row', marginTop: 15, gap: 10 },
  customInput: { flex: 1, backgroundColor: '#000', color: '#fff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  addBtnSmall: { backgroundColor: '#fff', width: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  counterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E1E1E', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
  rowLabel: { color: '#fff', fontSize: 16, fontWeight: '500' },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  cntBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  cntValue: { color: '#fff', fontSize: 18, fontWeight: 'bold', minWidth: 20, textAlign: 'center' },
  staffCard: { backgroundColor: '#1E1E1E', padding: 15, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  tinyLabel: { color: '#666', fontSize: 12, marginTop: 10, marginBottom: 5 },
  skillChip: { marginRight: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, borderWidth: 1, borderColor: '#444' },
  skillChipActive: { backgroundColor: '#fff', borderColor: '#fff' },
  skillChipInactive: { backgroundColor: '#000' },
  skillText: { color: '#888', fontSize: 12, fontWeight: '600' },
  skillInput: { flex: 1, backgroundColor: '#1E1E1E', color: '#fff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  addSkillBtn: { backgroundColor: '#fff', paddingHorizontal: 15, borderRadius: 8, justifyContent: 'center' },
  addSkillRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  rowItem: { backgroundColor: '#1E1E1E', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  checkCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  rowText: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '600' },
  miniInput: { backgroundColor: '#000', color: '#fff', padding: 8, borderRadius: 8, width: 70, textAlign: 'center', borderWidth: 1, borderColor: '#333' },
  durationWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', borderRadius: 8, borderWidth: 1, borderColor: '#333', paddingRight: 5 },
  miniInputTime: { color: '#fff', padding: 8, width: 35, textAlign: 'center' },
  unitText: { color: '#666', fontSize: 10, marginRight: 2 },
  mappingRow: { flexDirection: 'row', gap: 10, marginTop: 10, paddingLeft: 40 },
  mapBadge: { flexDirection: 'row', gap: 5, backgroundColor: '#333', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, alignItems: 'center' },
  mapText: { color: '#ccc', fontSize: 10, fontWeight: 'bold' },
  addBox: { flexDirection: 'row', gap: 10, marginTop: 10 },
  addInput: { backgroundColor: '#1E1E1E', color: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#333' },
  addBtn: { width: 50, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
  chip: { backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
  scheduleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E1E1E', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
  dayText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  hourInput: { backgroundColor: '#000', color: '#fff', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, borderWidth: 1, borderColor: '#333', fontSize: 14, textAlign:'center', minWidth: 60 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1E1E1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  modalItemText: { color: '#fff', fontSize: 16 },
  closeBtn: { backgroundColor: '#fff', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  nextBtn: { marginTop: 20, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 30, gap: 10 },
  nextBtnText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  finishBtn: { marginTop: 20, backgroundColor: '#4CAF50', padding: 18, borderRadius: 30, alignItems: 'center' },
  finishBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});