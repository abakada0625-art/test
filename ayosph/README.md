# AyosPH - Barangay Community Issue Reporting System

A modern web application for barangay community issue reporting and resolution tracking.

## Features

### For Residents
- Submit reports with photos and GPS location
- Track report status in real-time
- View report history
- Comment on reports
- Receive notifications on status updates

### For Barangay Officials
- Manage all community reports
- Update report statuses
- Upload proof-of-fix photos
- View analytics and statistics
- Export reports to CSV

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Deployment**: Vercel
- **Version Control**: GitHub

## Project Structure

```
ayosph/
├── index.html          # Landing page
├── login.html          # Login page
├── register.html       # Registration page
├── dashboard.html      # Resident dashboard
├── admin.html          # Admin dashboard
├── css/
│   ├── style.css       # Main styles
│   ├── auth.css        # Auth pages styles
│   ├── dashboard.css   # Dashboard styles
│   └── admin.css       # Admin styles
├── js/
│   ├── supabase.js     # Supabase config
│   ├── auth.js         # Authentication module
│   ├── utils.js        # Utility functions
│   ├── reports.js      # Reports management
│   ├── dashboard.js    # Dashboard logic
│   ├── admin.js        # Admin logic
│   └── notifications.js # Notifications
├── assets/
│   ├── images/
│   └── icons/
└── supabase-schema.sql # Database schema
```

## Setup Instructions

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the `supabase-schema.sql` file
3. Create storage buckets:
   - `report-images` (public)
   - `user-avatars` (public)
4. Get your project URL and anon key from Settings > API

### 2. Configure Environment

Update `/js/supabase.js` with your credentials:

```javascript
const SUPABASE_URL = 'your-supabase-url';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### 3. Create Admin User

1. Register a new account through the app
2. In Supabase Dashboard, go to Authentication > Users
3. Find your user and note the UUID
4. Go to SQL Editor and run:

```sql
UPDATE public.users SET role = 'admin' WHERE email = 'your-email@example.com';
```

### 4. Local Development

Open the project in a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .
```

Visit `http://localhost:8000`

## Deployment to Vercel

1. Push code to GitHub repository
2. Connect repository to Vercel
3. Set environment variables (if needed)
4. Deploy

## Database Schema

### Tables

- **users**: User profiles with role-based access
- **reports**: Community issue reports
- **comments**: Comments on reports
- **notifications**: User notifications

### Row Level Security (RLS)

All tables have RLS enabled with policies for:
- Users can only view/edit their own data
- Admins have full access
- Authenticated users can create reports and comments

## API Reference

### Authentication

```javascript
// Register
await Auth.register({ fullName, email, password, barangay, contactNumber });

// Login
await Auth.login({ email, password });

// Logout
await Auth.logout();
```

### Reports

```javascript
// Create report
await Reports.createReport({ title, description, category, severity, location, image });

// Fetch reports
await Reports.fetchReports({ status, category, search });

// Update status
await Reports.updateReportStatus(id, status, remarks, imageAfter);

// Add comment
await Reports.addComment(reportId, message);
```

## License

MIT License - Made for Filipino Communities
