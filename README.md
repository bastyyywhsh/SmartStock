# SmartStock

SmartStock is a web-based inventory and sales management system designed to help businesses manage products, monitor stock levels, record sales, manage customers, and generate sales reports.

## Features

- User Login and Registration
- Admin and Staff Roles
- Inventory Management
- Add, Edit, and Delete Products
- Product Search and Category Filtering
- Low Stock Warnings
- Sales Recording
- Automatic Stock Updates
- Customer Directory
- Dashboard Statistics
- Inventory Charts
- Sales Reports
- PDF Sales Report Export
- JWT Authentication
- PostgreSQL Database

## Technologies Used

### Frontend
- React
- TypeScript
- Vite
- Recharts
- jsPDF
- jsPDF AutoTable
- CSS

### Backend
- Node.js
- Express.js
- PostgreSQL
- JWT
- bcryptjs
- dotenv
- CORS

## Project Structure

```text
SmartStock/
│
├── backend/
│   ├── db.js
│   ├── server.js
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── .gitignore
└── README.md