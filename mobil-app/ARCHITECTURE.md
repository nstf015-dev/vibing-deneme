# VibeBeauty Super App - Architecture Documentation

## 🏗️ System Architecture Overview

This is a **hybrid platform** combining:
- **Social Network Layer** (TikTok/Instagram-like discovery)
- **Marketplace** (Booksy-like booking & SaaS)
- **Business Management** (Comprehensive SaaS dashboard)

---

## 📁 Project Structure

```
mobil-app/
├── app/                          # Expo Router screens (file-based routing)
│   ├── (tabs)/                   # Tab navigation screens
│   ├── business/                 # Business-related screens
│   └── ...
├── components/                   # Reusable UI components
│   ├── ui/                       # Base UI components
│   ├── social/                   # Social feed components
│   ├── booking/                  # Booking-related components
│   └── business/                 # Business dashboard components
├── lib/                          # Core libraries & configurations
│   ├── supabase.ts             # Supabase client
│   ├── api/                      # API layer (Supabase queries)
│   └── utils/                    # Utility functions
├── services/                     # Business Logic Layer
│   ├── booking/                  # Booking engine
│   ├── availability/             # Availability calculator
│   ├── social/                   # Social feed logic
│   ├── payment/                  # Payment processing
│   ├── notification/             # Push notifications
│   └── chat/                     # Real-time messaging
├── store/                        # State Management
│   ├── contexts/                 # React Context providers
│   ├── zustand/                  # Zustand stores
│   └── hooks/                    # Custom hooks
├── types/                        # TypeScript type definitions
│   ├── database.ts              # Database types (generated)
│   ├── business.ts              # Business domain types
│   └── social.ts                # Social domain types
├── hooks/                        # Shared React hooks
├── constants/                    # App constants
└── sql/                          # Database migrations
```

---

## 🗄️ Database Schema Design

### Core Tables

#### **Social Layer**
- `posts` - User/business posts (videos, images)
- `post_likes` - Like interactions
- `post_comments` - Comment threads
- `post_shares` - Share tracking
- `collections` - User moodboards/saved posts
- `post_service_link` - Links posts to specific services (for "Book This Look")

#### **Booking Layer**
- `business_services` - Service menu items
- `service_variable_pricing` - Dynamic pricing options
- `service_portfolio` - Service-specific gallery
- `staff` - Staff members
- `staff_services` - Staff-service assignments
- `staff_shifts` - Individual shift schedules
- `staff_breaks` - Break times
- `appointments` - Booking records
- `appointment_services` - Multi-service booking junction
- `waitlist_entries` - Waitlist management
- `resources` - Physical resources (chairs, rooms)

#### **Business SaaS**
- `campaigns` - Marketing campaigns
- `boost_orders` - Post boosting
- `customer_notes` - CRM notes
- `customer_tags` - Customer segmentation
- `pos_sales` - Point of sale transactions
- `pos_items` - Products for sale
- `stock_items` - Inventory management
- `staff_earnings` - Commission tracking

#### **Financial**
- `payment_intents` - Payment processing
- `cancellation_policies` - No-show protection rules
- `deposits` - Pre-payment tracking

#### **Communication**
- `conversations` - Chat threads
- `messages` - Individual messages
- `message_context` - Context linking (post/booking)
- `notifications` - Push notification queue

---

## 🔄 State Management Strategy

### **Two-Tier Approach:**

1. **React Context API** - For global app state
   - Authentication state
   - User profile
   - Theme preferences

2. **Zustand** - For feature-specific state
   - Social feed state
   - Booking cart
   - Business dashboard state
   - Chat state

---

## 🧠 Business Logic Modules

### **1. Booking Engine** (`services/booking/`)
- `availability-calculator.ts` - Core algorithm for slot calculation
- `multi-service-booking.ts` - Multi-service slot finder
- `conflict-resolver.ts` - Prevents double bookings
- `waitlist-manager.ts` - Waitlist logic

### **2. Availability Calculator** (`services/availability/`)
- Considers: Staff shifts, breaks, service duration, padding time, existing bookings
- Returns: Available time slots with metadata

### **3. Social Feed** (`services/social/`)
- `feed-generator.ts` - Algorithm for feed ordering
- `book-this-look.ts` - Direct booking from posts
- `engagement-tracker.ts` - Analytics

### **4. Payment Processing** (`services/payment/`)
- `stripe-integration.ts` - Stripe payment handling
- `deposit-manager.ts` - Deposit logic
- `refund-processor.ts` - Cancellation refunds

### **5. Notification System** (`services/notification/`)
- `push-notifier.ts` - Push notification sender
- `sms-sender.ts` - SMS reminders
- `notification-queue.ts` - Queue management

---

## 🎯 Key Features Implementation

### **"Book This Look" Flow**
1. User views post → Post has `service_id` and `staff_id` linked
2. User clicks "Book Now" → Navigate to booking with pre-filled data
3. Booking engine calculates availability for that specific staff/service
4. One-click booking completion

### **Multi-Service Booking**
1. User selects multiple services
2. System calculates total duration
3. Finds continuous time slot that fits all services
4. Assigns to single staff member (or multiple if needed)

### **Availability Algorithm**
```
For each time slot:
  1. Check staff shift availability
  2. Check staff breaks
  3. Check existing appointments (with padding time)
  4. Check resource availability (if needed)
  5. Return available slots
```

---

## 🚀 Performance Considerations

- **Video Optimization**: Lazy loading, thumbnail generation
- **Feed Pagination**: Infinite scroll with cursor-based pagination
- **Caching Strategy**: React Query for API caching
- **Image Optimization**: Supabase Storage with CDN
- **Real-time Updates**: Supabase Realtime subscriptions

---

## 🔐 Security & Policies

- **RLS (Row Level Security)**: All tables have proper RLS policies
- **No-Show Protection**: Configurable cancellation policies
- **Payment Security**: Stripe PCI compliance
- **Data Privacy**: GDPR-compliant data handling

---

## 📱 Mobile-First Design

- **Responsive UI**: Works on all screen sizes
- **Offline Support**: Cached data for offline viewing
- **Push Notifications**: Native push notification support
- **Deep Linking**: Direct links to posts/bookings

---

## 🧪 Testing Strategy

- **Unit Tests**: Business logic modules
- **Integration Tests**: API layer
- **E2E Tests**: Critical user flows
- **Performance Tests**: Load testing for booking engine

---

## 📈 Scalability

- **Horizontal Scaling**: Stateless API design
- **Database Optimization**: Proper indexing, query optimization
- **CDN**: Static assets via Supabase Storage
- **Caching**: Redis for frequently accessed data (future)

