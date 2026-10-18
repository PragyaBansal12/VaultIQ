# ExpenseIQ: AI-Powered Expense & Budget Management Platform

## 📌 Overview
ExpenseIQ is a full-stack fintech web application designed to help users track expenses, manage budgets, analyze spending patterns, and receive AI-powered financial insights. The platform combines modern web technologies, real-time data visualization, OCR-based receipt processing, and intelligent financial recommendations to simplify personal finance management.

---

## 🛠️ Architecture & Evolution
This project originally utilized **MongoDB** for rapid prototyping and flexible document storage during early development. 

To meet the strict data integrity, operational consistency, and complex relational tracking demands required by a robust financial ledger system, the storage layer was migrated to **PostgreSQL**. This ensures bulletproof ACID compliance for wallet-to-wallet transactions and highly optimized mathematical aggregations for monthly budget breakdowns.

---

## 🚀 Features

### Authentication & Security
* User Signup & Login
* JWT-based Authentication
* Password Hashing with `bcrypt`
* Protected Frontend and Backend Routes

### Expense Management
* Add, Edit, and Delete Expenses
* Category-wise Expense Tracking
* Receipt Upload Support with Auto-Parsing

### Budget Management
* Monthly Budget Limits & Category-wise Budgets
* Real-time Budget Utilization Tracking
* Automatic Overspending Detection

### Analytics Dashboard
* Spending Trends & Category Distribution Analysis
* Monthly Comparisons & Financial Health Insights
* Interactive Charts powered by `Recharts`

### Reports
* Monthly Financial Reports & Budget Performance Reports
* Spending Summaries & Exportable CSV Data Data

### AI-Powered Features
* **Intelligent Financial Insights:** Personal spending pattern analysis and saving recommendations.
* **Anomaly Detection:** Alerts for spending spikes or unusual transaction values.
* **OCR Receipt Processing:** Text extraction using `Tesseract.js` with automatic expense categorization.

### Notifications
* Budget Limit & Spending Spike Alerts
* Subscription Reminders & Monthly Summary Notifications

---

## 🏗️ System Architecture

```text
       Frontend (Next.js / React)
                   ↓
     Backend APIs (Node.js + Express)
                   ↓
  PostgreSQL Database (Managed via Aiven)
                   ↓
        Business Logic Layer
                   ↓
   AI Layer (LangChain + LangGraph)
                   ↓
           External Services
    (OCR Engines, Email Notifications)
