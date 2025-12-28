
# AuthDrop

> **Note:** AuthDrop is an evolution of the project [PairDrop](https://github.com/schlagmichdoch/PairDrop), with integrated group management, advanced device pairing, audit logging, and many other enhancements for professional and organizational use.

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![Express](https://img.shields.io/badge/Express-4.x-blue.svg)
![SQLite3](https://img.shields.io/badge/SQLite3-Latest-lightblue.svg)
![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![Platform](https://img.shields.io/badge/Platform-Windows%20|%20Linux%20|%20macOS-lightgrey.svg)

**A modern web application for peer-to-peer file transfer directly in your browser**

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support%20-yellow.svg?logo=buy-me-a-coffee&logoColor=white)](https://buymeacoffee.com/guidoballau)

</div>

---

**AuthDrop** is a web application for peer-to-peer file transfer that works directly in your browser, with no installation required.

> 🔒 **Security Notice:** For new installations, please read [SECURITY.md](SECURITY.md) for important security guidelines and best practices.

## Features

- 🔄 Peer-to-peer file transfer via WebRTC
- 🌐 Fully browser-based (PWA)
- 🔒 Direct and secure device-to-device connection
- 📱 Multi-platform support (Windows, Mac, Linux, iOS, Android)
- 💾 No file size limits
- 🚀 Transfer speed limited only by your network
- 🌍 35+ languages supported
- 🎨 Automatic light/dark theme
- 📴 Works offline after first visit
- 🔐 Total privacy: files never pass through external servers
- 👥 **User & Group Management** with role-based access control
- 🔗 **LDAP/Active Directory Integration** for enterprise environments
- 📊 **Audit Log** for compliance and security tracking
- 🏢 **Multi-database support**: SQLite (easy setup) or PostgreSQL (production-ready)


## Dashboard Screenshots

Below are some screenshots of the AuthDrop dashboard:

### Main Dashboard
![Main Dashboard](screenshot/2025-12-28%2013_22_48-.png)


### Group Management
![Group Management](screenshot/2025-12-28%2013_23_52-.png)

### Device List
![Device List](screenshot/2025-12-28%2013_27_16-.png)

## Technologies

- **Frontend**: HTML5, CSS3, JavaScript ES6
- **Backend**: Node.js with Express
- **Communication**: WebRTC and WebSockets
- **PWA**: Progressive Web App


## Installation

## Installation

### 1. Manual (npm)

#### Prerequisites
- Node.js >= 18.0.0
- npm
- **Database**: Choose one:
  - **SQLite** (default, no setup required) - Perfect for development and small deployments
  - **PostgreSQL** (recommended for production) - Better performance and scalability

#### Steps
1. **Clone the repository**
	```bash
	git clone https://github.com/Gheben/AuthDropLdap.git
	cd AuthDropLdap
	```

2. **Configure environment**
	- Copy `.env.example` to `.env` and edit with your settings:
	  ```bash
	  cp .env.example .env
	  # Edit .env with your credentials
	  ```
	
	- **IMPORTANT:** Change the default passwords in `.env`:
	
	**For SQLite (easiest setup):**
	```env
	SUPER_ADMIN_USERNAME=admin
	SUPER_ADMIN_PASSWORD=YourSecurePassword123!
	
	# Database Configuration
	DB_TYPE=sqlite
	# SQLite creates authdrop.db automatically - no other DB config needed!
	```
	
	**For PostgreSQL (production):**
	```env
	SUPER_ADMIN_USERNAME=admin
	SUPER_ADMIN_PASSWORD=YourSecurePassword123!
	
	# Database Configuration
	DB_TYPE=postgres
	DB_HOST=localhost
	DB_PORT=5432
	DB_USER=authdrop
	DB_PASSWORD=YourDBPassword123!
	DB_NAME=authdrop
	```
	
	Then create the PostgreSQL database:
	```bash
	# Connect to PostgreSQL as admin
	psql -U postgres
	
	# Create database and user
	CREATE DATABASE authdrop;
	CREATE USER authdrop WITH PASSWORD 'YourDBPassword123!';
	GRANT ALL PRIVILEGES ON DATABASE authdrop TO authdrop;
	\q
	```

3. **Install dependencies**
	```bash
	npm install
	```

4. **Start the server**
	```bash
	npm start
	```
	
	The server will:
	- Automatically create the database schema (SQLite or PostgreSQL)
	- Create the super admin user from your `.env` credentials
	- Be available at `http://localhost:3441`

5. **First Login**
	- Navigate to `http://localhost:3441/admin.html`
	- Login with your super admin credentials from `.env`
	- Start managing users and groups!

### 2. Docker Compose


#### Prerequisites
- Docker & Docker Compose installed

#### Steps
1. **Clone the repository**
	```bash
	git clone https://github.com/Gheben/AuthDrop.git
	cd AuthDrop
	```
2. **Configure environment**
	- Copy `.env.example` to `.env` and customize the settings:
	  ```bash
	  cp .env.example .env
	  # Edit .env with your credentials
	  ```
	- **IMPORTANT:** Change the default passwords before starting:
	  ```
	  SUPER_ADMIN_USERNAME=admin
	  SUPER_ADMIN_PASSWORD=YourSecurePassword123!
	  
	  DB_TYPE=postgres
	  DB_HOST=postgres
	  DB_PORT=5432
	  DB_USER=authdrop
	  DB_PASSWORD=YourDBPassword123!
	  DB_NAME=authdrop
	  
	  POSTGRES_USER=authdrop
	  POSTGRES_PASSWORD=YourDBPassword123!
	  POSTGRES_DB=authdrop
	  ```
3. **Start with Docker Compose**
	```bash
	docker compose up -d
	```
	This will start both the Node.js server and a PostgreSQL database container.
	The app will be available at `http://localhost:3441`

---

## Development

```bash
# Development mode
npm run dev
```

## Deployment

## Deployment

### With Docker (standalone)

```bash
docker build -t authdrop .
docker run -d --restart=unless-stopped --name=authdrop -p 3441:3441 authdrop
```

### With Node.js (production)

```bash
npm run start:prod
```

## Project Structure

```
AuthDrop/
├── public/           # Frontend files (HTML, CSS, JS, images)
├── server/           # Node.js backend
├── package.json      # npm configuration
└── README.md         # This file
```

## How It Works

1. Open AuthDrop in the browser on all devices you want to connect
2. Devices on the same local network will automatically discover each other
3. Click on the target device and select the files to send
4. The transfer happens directly between devices (P2P)

## Advanced Features

### LDAP/Active Directory Integration

AuthDrop supports seamless integration with LDAP/Active Directory for enterprise environments. This allows you to:
- Automatically import users and groups from your AD
- Authenticate users against your existing AD credentials
- Maintain group hierarchies and permissions
- Automatically sync changes from AD

#### LDAP Group Hierarchy Logic

AuthDrop uses a **hierarchical group model** for security and organization:

```
AD Structure:
├── APP_AuthDrop (Parent Group - Main Access Control)
│   ├── IT_Department (Subgroup)
│   │   ├── User1
│   │   ├── User2
│   │   └── User3
│   ├── Sales_Department (Subgroup)
│   │   ├── User4
│   │   └── User5
│   └── HR_Department (Subgroup)
│       └── User6
```

**Key Concepts:**

1. **Parent Group** (e.g., `APP_AuthDrop`)
   - The main access control group
   - **Users should NOT be directly added here**
   - Only subgroups should be members
   - Used in `LDAP_GROUP_SEARCH_FILTER` to define the scope

2. **Subgroups** (e.g., `IT_Department`, `Sales_Department`)
   - Created as members of the parent group
   - **This is where you add actual users**
   - Each subgroup represents a department, team, or organizational unit
   - Users in a subgroup can only see devices/rooms of their group members

3. **User Isolation**
   - Users in `IT_Department` only see devices from other IT users
   - Users in `Sales_Department` only see devices from other Sales users
   - Complete separation between different departments/groups

#### LDAP Configuration Example

In your `.env` file:

```env
# Enable LDAP
LDAP_ENABLED=true

# LDAP Server (use ldaps:// for secure connection)
LDAP_URL=ldaps://dc.yourcompany.local:636

# Accept self-signed certificates (for testing only!)
LDAP_TLS_REJECT_UNAUTHORIZED=false

# Service Account with read permissions
LDAP_BIND_DN=CN=ServiceAccount,OU=ServiceAccounts,DC=yourcompany,DC=local
LDAP_BIND_PASSWORD=YourServiceAccountPassword

# Base DN
LDAP_BASE_DN=DC=yourcompany,DC=local

# Group Search - IMPORTANT: This defines your parent group!
LDAP_GROUP_SEARCH_BASE=OU=Groups,DC=yourcompany,DC=local
LDAP_GROUP_SEARCH_FILTER=(|(CN=APP_AuthDrop)(memberOf=CN=APP_AuthDrop,OU=Groups,DC=yourcompany,DC=local))

# User Search (leave empty to import only users from subgroups)
LDAP_USER_SEARCH_BASE=
LDAP_USER_SEARCH_FILTER=(&(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))
```

#### Setting Up LDAP on Active Directory

1. **Create the Parent Group**
   ```powershell
   New-ADGroup -Name "APP_AuthDrop" -GroupScope Global -GroupCategory Security -Path "OU=Groups,DC=yourcompany,DC=local"
   ```

2. **Create Subgroups**
   ```powershell
   # Create IT Department subgroup
   New-ADGroup -Name "AuthDrop_IT" -GroupScope Global -GroupCategory Security -Path "OU=Groups,DC=yourcompany,DC=local"
   
   # Add IT subgroup to parent group
   Add-ADGroupMember -Identity "APP_AuthDrop" -Members "AuthDrop_IT"
   
   # Create Sales subgroup
   New-ADGroup -Name "AuthDrop_Sales" -GroupScope Global -GroupCategory Security -Path "OU=Groups,DC=yourcompany,DC=local"
   
   # Add Sales subgroup to parent group
   Add-ADGroupMember -Identity "APP_AuthDrop" -Members "AuthDrop_Sales"
   ```

3. **Add Users to Subgroups (NOT to parent!)**
   ```powershell
   # Add users to IT subgroup
   Add-ADGroupMember -Identity "AuthDrop_IT" -Members "user1", "user2", "user3"
   
   # Add users to Sales subgroup
   Add-ADGroupMember -Identity "AuthDrop_Sales" -Members "user4", "user5"
   ```

4. **Sync from AuthDrop Admin Panel**
   - Login to `http://localhost:3441/admin.html`
   - Go to **LDAP** tab
   - Click **Test Connection** to verify settings
   - Click **Preview** to see what will be imported
   - Click **Sync** to import users and groups

#### LDAP Features

- ✅ **Automatic user import** from AD subgroups
- ✅ **Group hierarchy preservation** (parent group excluded from sync)
- ✅ **Read-only LDAP entities** (users/groups from AD cannot be modified in AuthDrop)
- ✅ **Orphan cleanup** (automatically removes users/groups deleted from AD)
- ✅ **Audit logging** for all LDAP operations
- ✅ **Visual indicators** (🔗 icon) for LDAP-imported entities
- ✅ **Dual authentication** (LDAP users use AD credentials, local users use AuthDrop passwords)

#### Running Migrations

After configuring LDAP, run these migrations to prepare the database:

```bash
# Add LDAP support to database
node migrate-ldap.js

# Add group admin permissions support
node migrate-group-admin.js

# Add LDAP cleanup statistics support
node migrate-ldap-cleanup.js
```

**Note:** Migrations are idempotent and safe to run multiple times.

### Device Pairing
You can permanently pair your devices by entering a shared room code, even if they are on different networks.

### Reset Database to Clean State
If you need to reset the database to a clean state with only the super admin user from `.env`:

**For PostgreSQL:**
```bash
node reset-postgres.js
```

**For Docker Compose:**
```bash
docker compose down -v  # Remove all volumes (deletes all data!)
docker compose up -d    # Recreate with fresh database
```

**Note:** These operations will **DELETE ALL DATA** including users, groups, logs, and sessions. The database will be recreated with only the super admin user defined in your `.env` file.

## FAQ

**Is it secure?**  
Yes, files are transferred directly between your devices using WebRTC. They never pass through external servers.

**Does it work without internet?**  
Yes, on the local network it works offline. Internet is only needed for the initial signaling server.

**Which browsers are supported?**  
All modern browsers: Chrome, Edge, Firefox, Safari, Opera.

**Can I use it with devices on different networks?**  
Yes, by using the pairing feature with a shared room code.

**SQLite or PostgreSQL - which one should I use?**
- **SQLite**: Perfect for development, testing, and small deployments (< 50 users). Zero configuration required - just set `DB_TYPE=sqlite` and you're done!
- **PostgreSQL**: Recommended for production environments with many users, better performance, concurrent access, and enterprise features.

**Can I switch from SQLite to PostgreSQL later?**
Yes! Both databases use the exact same schema. To migrate:
1. Export data from SQLite (if you have important data)
2. Change `DB_TYPE=postgres` in `.env` and configure PostgreSQL settings
3. Restart the server - it will automatically create the schema in PostgreSQL
4. Import your data (or start fresh)

**Does LDAP work with both SQLite and PostgreSQL?**
Yes! LDAP integration works identically with both database backends. Choose the database that fits your deployment needs.

**What happens if I change something in Active Directory?**
When you run a sync from the LDAP tab:
- New users/groups in AD subgroups are automatically imported
- Updated information (email, display name) is synchronized
- Users/groups deleted from AD are automatically removed from AuthDrop
- Group memberships are updated to match AD

## Author

Guido Ballarini - [git.ballarini.app](https://git.ballarini.app/guido/AuthDrop)

## License

GPL-3.0
