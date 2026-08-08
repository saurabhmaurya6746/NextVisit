# NextVisit — CRM & Business Automation Platform

> A full-stack CRM and business automation platform designed for service-based businesses to manage customers, appointments, visits, loyalty programs, campaigns, and business analytics from a centralized platform.

---

## 📌 Overview

**NextVisit** is a multi-business CRM and automation platform built to help businesses manage their day-to-day customer operations digitally.

The platform provides dedicated workflows for businesses such as **salons and restaurants**, while allowing administrators to manage businesses, subscriptions, users, and platform-level operations from a centralized admin panel.

The main goal of NextVisit is to reduce manual business processes and help businesses improve **customer retention, repeat visits, loyalty, and operational efficiency**.

---

## 🚀 Key Features

### 👥 Customer Management

* Centralized customer database
* Customer profiles and visit history
* New and returning customer tracking
* Customer activity management
* Customer engagement tracking

### 📅 Appointment & Visit Management

* Appointment/visit creation and management
* Visit status tracking
* Service and staff association
* Payment and visit completion workflows
* Business-specific visit management

### 🎁 Loyalty Program

* Configurable loyalty points
* Points earned through customer visits/purchases
* Customer loyalty tracking
* Loyalty points included in customer engagement workflows

### 📢 Marketing & Campaigns

* Customer campaigns
* Promotional offers
* Coupon management
* Festival campaigns
* Birthday offers
* Lost-customer recovery campaigns
* Automated customer engagement workflows

### ⭐ Review Management

* Customer review collection
* Google review focused workflows
* Review request automation
* Customer feedback management

### 📊 Business Dashboard & Analytics

* Revenue tracking
* Customer statistics
* Appointment/order statistics
* Loyalty metrics
* Business performance reports
* Date-based reporting
* Daily, weekly and monthly insights

### 💬 WhatsApp Integration

* Customer communication workflows
* WhatsApp-based notifications
* Payment/invoice communication
* Campaign messaging support

### 📱 QR-Based Restaurant Workflow

* QR-based table/customer interaction
* Digital ordering workflow
* Visit/token-based order management
* Add-more-items functionality
* Payment and visit completion flow
* Automatic table status management

### 🏪 Multi-Business Support

NextVisit is designed to support different business types with dedicated workflows.

Currently supported business workflows include:

* 💇 **Salon**
* 🍽️ **Restaurant**

The system dynamically adapts the business interface and available functionality according to the selected business type.

### 👨‍💼 Admin & Super Admin

* Business management
* Business approval/rejection
* User management
* Subscription management
* Business type management
* Platform-level dashboard
* Activity monitoring
* Administrative controls

---

## 🏗️ System Architecture

```text
                    ┌──────────────────────┐
                    │      NextVisit       │
                    │    Web Application   │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │      Next.js         │
                    │ React + TypeScript   │
                    │      Tailwind CSS    │
                    └──────────┬───────────┘
                               │
                         REST API / HTTP
                               │
                               ▼
                    ┌──────────────────────┐
                    │       FastAPI        │
                    │       Backend        │
                    └──────────┬───────────┘
                               │
                    ┌──────────┴───────────┐
                    ▼                      ▼
             ┌──────────────┐      ┌──────────────┐
             │  SQLAlchemy  │      │   Business   │
             │     ORM      │      │    Logic     │
             └──────┬───────┘      └──────────────┘
                    │
                    ▼
             ┌──────────────┐
             │  PostgreSQL  │
             │   Database   │
             └──────────────┘
```

---

## 🛠️ Technology Stack

### Frontend

* **Next.js**
* **React**
* **TypeScript**
* **Tailwind CSS**
* **Vite / Modern Frontend Tooling**

### Backend

* **Python**
* **FastAPI**
* **Pydantic**
* **SQLAlchemy 2.0**
* **Alembic**
* **REST APIs**

### Database

* **PostgreSQL**

### Architecture & Development

* Repository-Service pattern
* Modular API architecture
* Business-type based workflows
* RESTful API design
* JWT-based authentication
* Database migrations with Alembic

---

## 📂 Project Structure

```text
NextVisit/
│
├── Frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── routes/
│   │   ├── pages/
│   │   ├── services/
│   │   └── ...
│   ├── package.json
│   └── ...
│
├── Backend/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── core/
│   │   └── main.py
│   │
│   ├── alembic/
│   ├── requirements.txt
│   └── ...
│
├── README.md
└── ...
```

---

## ⚙️ Getting Started

### Prerequisites

Make sure the following are installed:

* Node.js
* npm
* Python 3.10+
* PostgreSQL
* Git

---

### 1. Clone the Repository

```bash
git clone https://github.com/saurabhmaurya6746/nextvisit.git
cd nextvisit
```

> Update the repository URL above if your GitHub repository uses a different name.

---

## 🔹 Backend Setup

Navigate to the backend directory:

```bash
cd Backend
```

Create and activate a virtual environment:

### Windows

```bash
python -m venv venv
venv\Scripts\activate
```

### Linux / macOS

```bash
python3 -m venv venv
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Configure the required environment variables in `.env`.

Example:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/nextvisit
SECRET_KEY=your_secret_key
```

Run database migrations:

```bash
alembic upgrade head
```

Start the FastAPI server:

```bash
uvicorn app.main:app --reload
```

Backend will be available at:

```text
http://localhost:8000
```

API documentation:

```text
http://localhost:8000/docs
```

---

## 🔹 Frontend Setup

Open a new terminal and navigate to the frontend:

```bash
cd Frontend
```

Install dependencies:

```bash
npm install
```

Create the required `.env` configuration and add the backend API URL.

Example:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the development server:

```bash
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:3000
```

---

## 🔐 Environment Variables

Sensitive credentials and API keys are **not included in the repository**.

Create your own `.env` files using the required environment variable names.

Typical configuration includes:

```env
DATABASE_URL=
SECRET_KEY=
JWT_SECRET_KEY=
API_BASE_URL=
```

> Never commit passwords, API keys, database credentials, or other secrets to GitHub.

---

## 📊 Major Modules

```text
NextVisit
│
├── Authentication
├── Business Management
├── Customer Management
├── Appointments / Visits
├── Services
├── Staff Management
├── Loyalty Program
├── Coupons
├── Campaigns
├── Automation Engine
├── Message Templates
├── WhatsApp Integration
├── Review Management
├── Reports & Analytics
├── Restaurant QR Ordering
├── Subscription Management
├── Admin Panel
└── Super Admin Panel
```

---

## 💡 Why NextVisit?

Many small and medium-sized service businesses manage customer information, appointments, marketing, loyalty, and follow-ups using multiple disconnected tools or manual processes.

NextVisit brings these operations together into a single platform.

The platform focuses on:

* Reducing manual work
* Centralizing customer information
* Improving customer retention
* Automating customer engagement
* Tracking business performance
* Providing business-specific workflows

---

## 🔮 Future Improvements

Planned and potential improvements include:

* AI-powered marketing assistance
* Advanced customer segmentation
* Predictive customer retention analytics
* More automated WhatsApp workflows
* Advanced business intelligence
* Additional business types
* Mobile application support
* Enhanced reporting and analytics

---

## 📸 Screenshots

> Screenshots of the dashboard, customer management, appointments, loyalty program, reports, and business-specific workflows can be added here.

Example:

```text
docs/
└── screenshots/
    ├── dashboard.png
    ├── customers.png
    ├── appointments.png
    ├── loyalty.png
    └── reports.png
```

---

## 🔒 Security

NextVisit follows standard practices for protecting application data and credentials.

* Sensitive credentials are stored through environment variables.
* Authentication is handled through secure token-based mechanisms.
* Database access is managed through SQLAlchemy.
* Secrets and configuration files are excluded from version control.

---

## 📌 Project Status

**Active Development**

NextVisit is an actively developed full-stack CRM and business automation platform.

---

## 👨‍💻 Author

**Saurabh Maurya**

B.Tech — Computer Science & Engineering

Full Stack Developer | Python | FastAPI | React | Next.js | PostgreSQL

### GitHub

**Saurabh Maurya**
GitHub: `https://github.com/saurabhmaurya6746`

---

## ⭐ Acknowledgement

This project was designed and developed as a full-stack software project with a focus on real-world business workflows, scalable backend architecture, and modern web application development.

If you find the project useful or interesting, consider giving the repository a ⭐.
