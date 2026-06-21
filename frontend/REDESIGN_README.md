# VeritasChain Frontend - Glassmorphism Design Redesign

This is a complete redesign of the VeritasChain frontend with a modern glassmorphism aesthetic, improved UX, and full feature implementation.

## 🎨 Design System

The frontend uses a **glassmorphism** design approach with:
- Frosted glass effect (backdrop blur + transparency)
- Modern gradient backgrounds
- Smooth animations with Framer Motion
- Responsive design for mobile/tablet/desktop
- Glass-style cards, buttons, and inputs

## 📦 New Dependencies

The following packages were added for this redesign:

```bash
npm install framer-motion lucide-react axios clsx
```

- **framer-motion**: Smooth animations and transitions
- **lucide-react**: Beautiful SVG icons
- **axios**: HTTP client for API calls
- **clsx**: Utility for conditional className handling

## 🏗️ Project Structure

```
src/
├── components/
│   ├── Layout.jsx                    # Main layout with sidebar
│   ├── NotificationContainer.jsx     # Toast notifications
│   ├── ui/
│   │   └── GlassmorphicComponents.jsx # Reusable UI components
│   └── [other components]
├── context/
│   ├── NotificationContext.jsx       # Notification management
│   └── [other contexts]
├── hooks/
│   └── useNotification.js            # Notification hook
├── pages/
│   ├── LoginNew.jsx                  # Redesigned login page
│   ├── RegisterNew.jsx               # Multi-step registration
│   ├── OrgSetupProgressPage.jsx      # Org creation with countdown
│   ├── AdminLoginPage.jsx            # Admin authentication
│   ├── DashboardNew.jsx              # Main dashboard
│   ├── OrderCreateNew.jsx            # Order creation form
│   ├── OrdersNew.jsx                 # Orders list and management
│   └── [other pages]
├── services/
│   └── api.js                        # API endpoints
├── styles/
│   ├── glassmorphism.css            # Glassmorphism design system
│   ├── layout.css                    # Layout styles
│   ├── notifications.css             # Notification styles
│   └── dashboard.css                 # Dashboard styles
└── App.jsx                            # Main app with routing
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env.local
# Edit .env.local to set your API URL
```

### 3. Start Development Server
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

### 4. Build for Production
```bash
npm run build
npm run preview
```

## 📄 Page Descriptions

### Login Page (`/login`)
- Clean, centered design with company branding
- Email/Username and password inputs
- Link to registration and admin login

### Registration Page (`/register`)
- Multi-step form with progress indicator
- Step 1: Organization info (name, type, description)
- Step 2: Contact details (email, phone)
- Step 3: Security (password setup)
- Step 4: Review and confirmation
- Shows MSPID and org name during setup

### Organization Setup Progress (`/org-setup-progress`)
- Loading screen with countdown timer
- Shows organization MSPID and name
- Auto-refreshes every 3 seconds + manual refresh button
- Displays estimated setup time
- Redirects to login when ready

### Admin Login (`/admin-login`)
- Separate authentication for admins
- Requires admin key from backend .env
- Access to platform management

### Dashboard (`/dashboard`)
- Sidebar with user profile (org name, MSPID, type)
- List of all organizations with connection status
- Quick actions panel (Create Order, View Channels)
- Active channels display
- Statistics cards (active channels, total orgs, status)
- Connect button to establish channels with other orgs

### Create Order (`/orders/create`)
- Form with validation
- Fields:
  - Channel selection
  - Supplier selection
  - Component type
  - Quantity
  - Specifications
  - Deadline (datetime picker)
- Real-time validation
- Confirmation before submission

### Orders List (`/orders`)
- Display all orders for current channel
- Filter by status (Pending, Fulfilled, Accepted, Rejected)
- Channel selection dropdown
- Order cards showing:
  - Component type
  - Order ID
  - Quantity
  - Deadline
  - Current status
- Click to view order details

## 🔧 API Integration

The frontend connects to the backend API endpoints:

```
POST   /orgs/login              - Organization login
POST   /orgs/register           - Organization registration
GET    /orgs                    - List all organizations
GET    /orgs/:id                - Get organization details
GET    /orgs/by-msp/:mspId      - Get org by MSP ID

POST   /channels/request        - Request channel with org
GET    /channels?orgId=xxx      - List org's channels
GET    /channels/:id            - Get channel details

POST   /orders                  - Create new order
GET    /orders                  - List orders
GET    /orders/:id              - Get order details
GET    /orders/:id/history      - Get order history
POST   /orders/:id/fulfill      - Fulfill order
POST   /orders/:id/verify       - Verify fulfillment
POST   /orders/:id/reject       - Reject order
POST   /orders/:id/feedback     - Submit feedback

POST   /requirements            - Set requirements
GET    /requirements            - Get requirements

GET    /admin/orgs              - List all orgs (admin)
GET    /admin/channels          - List all channels (admin)
POST   /admin/orgs/:id/ban      - Ban organization
POST   /admin/orgs/:id/unban    - Unban organization
DELETE /admin/orgs/:id          - Delete organization
DELETE /admin/channels/:id      - Delete channel
```

## 🎨 UI Components

### GlassmorphicComponents
Pre-built components with glassmorphism design:

```jsx
import {
  GlassmorphicCard,      // Frosted glass card container
  GlassmorphicButton,    // Interactive button
  GlassmorphicInput,     // Text input field
  GlassmorphicTextarea,  // Multi-line text
  GlassmorphicSelect,    // Dropdown select
  LoadingSpinner,        // Animated spinner
} from './components/ui/GlassmorphicComponents';
```

### Layout
```jsx
import { Layout, CenteredLayout } from './components/Layout';

// Full layout with sidebar
<Layout user={user} onLogout={handleLogout} sidebarContent={...}>
  {children}
</Layout>

// Centered layout for auth pages
<CenteredLayout>
  {children}
</CenteredLayout>
```

### Notifications
```jsx
import { useToast } from './hooks/useNotification';

const { success, error, warning, info, loading } = useToast();

success('Operation completed!');
error('Something went wrong');
warning('Please be careful');
info('FYI: Important info');
const id = loading('Processing...');
```

## ✨ Features Implemented

✅ **Authentication**
- Login with email/username and password
- Multi-step registration with progress
- Admin authentication with API key
- Organization creation progress tracking

✅ **Dashboard**
- Organization listing with type badges
- Connection/channel management
- User profile sidebar
- Quick action buttons
- Statistics cards

✅ **Organizations**
- Register new organizations
- Track MSPID and setup status
- View organization details
- Connect with other orgs on channels

✅ **Channels**
- Request channels with other organizations
- View active channels
- Channel status tracking

✅ **Orders** (Framework ready)
- Create orders with specifications
- View orders by channel
- Filter orders by status
- Order details and history (endpoints ready)

✅ **Notifications**
- Toast notifications (auto-dismiss)
- Error alerts
- Success confirmations
- Loading states

✅ **Responsive Design**
- Mobile-first approach
- Tablet optimization
- Desktop layout
- Glassmorphism preserved across all breakpoints

## 🔐 Security

- User authentication via JWT (stored in localStorage)
- Admin key validation on backend
- Protected routes require authentication
- API calls include proper headers
- Password requirements (min 8 characters)

## 📱 Responsive Breakpoints

- **Mobile**: < 640px - Full-screen single column
- **Tablet**: 640px - 1024px - 2-column grid
- **Desktop**: > 1024px - 3-column grid with sidebar

## 🚧 Additional Pages to Implement

The following pages need implementation (endpoints are ready on backend):

1. **Order Details Page** (`/orders/:id`)
   - Show full order details
   - Display specifications
   - Show fulfillment status

2. **Order Fulfillment Page** (`/orders/:id/fulfill`)
   - Supplier fulfillment form
   - Accept/reject orders
   - Upload fulfillment files
   - Add batchID, zkProof, publicSignals

3. **Order Verification Page** (`/orders/:id/verify`)
   - Manufacturer verification
   - Accept/reject fulfillment
   - ZK proof verification
   - Complete transaction

4. **Admin Dashboard** (`/admin-dashboard`)
   - View all organizations
   - View all channels
   - Ban/unban organizations
   - Delete channels

5. **Channels Management** (`/channels`)
   - List user's channels
   - Request new channels
   - View channel details

## 📝 Notes

- The design uses CSS variables for theming (see `glassmorphism.css`)
- All animations use Framer Motion for smooth transitions
- Icons come from Lucide React (open-source)
- The backend API URL is configurable via environment variables
- localStorage is used for user session management

## 🐛 Known Issues & TODO

- [ ] Admin dashboard page not yet implemented
- [ ] Order detail view page not yet implemented
- [ ] Fulfillment page needs file upload implementation
- [ ] ZK proof verification UI needs implementation
- [ ] Error boundaries not yet added
- [ ] Loading states for long-running operations
- [ ] Pagination for large order lists
- [ ] Search functionality across pages
- [ ] Export orders to CSV
- [ ] Audit log view

## 🤝 Contributing

When adding new features:
1. Follow the glassmorphism design system
2. Use the provided UI components
3. Add proper error handling with notifications
4. Test on mobile and desktop
5. Update this README

## 📞 Support

For issues or questions:
1. Check the backend API documentation
2. Review the API service file (`services/api.js`)
3. Check browser console for errors
4. Verify environment variables are set correctly
