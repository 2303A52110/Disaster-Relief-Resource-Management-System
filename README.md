#  Smart Disaster Relief Resource Management System

A backend application developed to efficiently manage disaster relief operations, including relief camps, victim registration, and resource distribution during emergencies such as floods and earthquakes.

---

## 🌐 Live Application

https://disaster-relief-resource-management.onrender.com

---

## 📖 Project Overview

In disaster scenarios, efficient coordination of camps, victims, and resources is critical. This system provides a structured solution to:

* Manage multiple relief camps with defined capacities 🏕️
* Register and track victims with health conditions 👥
* Allocate camps dynamically based on availability ⚙️
* Distribute essential resources such as food packets and medical kits 📦
* Prioritize critical victims for medical assistance 🚨
* Maintain records and generate analytical summaries 📊

---

## 🎯 Objectives

* Ensure efficient utilization of relief camp resources
* Prevent over-allocation of camps
* Provide priority support to critical victims
* Maintain accurate and accessible records
* Enable administrative monitoring through reports

---

## ✨ Core Features

### 🏕️ Camp Management

* Create and manage relief camps
* Track:

  * Camp ID
  * Location
  * Maximum capacity
  * Available food packets 
  * Medical kits 
  * Volunteers

---

### 👥 Victim Registration

* Store victim details:

  * ID, Name, Age
  * Health condition (Normal / Critical) 🚨
  * Assigned camp

* System validations:

  * Automatic camp allocation
  * Prevents assignment when camp is full 

---

### 📦 Resource Allocation

* Distribute food packets and medical kits
* Priority handling for critical victims ⚠️
* Automatic update of resource quantities 🔄

---

### 📊 Reporting & Analysis

The system generates key insights:

* Total number of camps
* Total victims registered
* Camp with highest occupancy
* Total food packets distributed
* Total medical kits distributed
* Number of critical victims

---

### 🔍 Search & Operations

* Search victim by ID
* View all records
* Perform repeated administrative operations

---

## 🛠️ Technology Stack

* **Backend:** Node.js, Express.js
* **Data Storage:** JSON (file-based persistence)
* **Deployment:** Render

---

## 📁 Project Structure

```
backend/
 ├── app.js
 ├── run_app.js
 ├── package.json
 ├── camps.json
 ├── victims.json
```

---

## ⚙️ API Endpoints

### Camps

* GET /camps → Retrieve all camps
* POST /camps → Add new camp
* PUT /camps/:id → Update camp
* DELETE /camps/:id → Delete camp

---

### Victims

* GET /victims → Retrieve all victims
* POST /victims → Register victim 
* PUT /victims/:id → Update victim
* DELETE /victims/:id → Remove victim

---

## 🔄 System Workflow

1. Administrator creates relief camps
2. Victims are registered into the system
3. Camp allocation is performed based on capacity
4. Resources are distributed accordingly
5. Data is stored and maintained
6. Reports are generated for analysis

---

## 📸 Screenshots

### Dashboard

<img width="2850" height="1525" alt="image" src="https://github.com/user-attachments/assets/f94c7ce0-b37a-49a7-9942-4ef264d71434" />


---

### Get All Camps

<img width="2850" height="1525" alt="image" src="https://github.com/user-attachments/assets/6d56762a-82ef-4933-aa44-5fc29f738ae9" />


---

### Add New Camp

<img width="2850" height="1150" alt="image" src="https://github.com/user-attachments/assets/c256d9a4-3a9b-4877-8049-983375c4b3c5" />



---

### Register Victim

<img width="2850" height="1150" alt="image" src="https://github.com/user-attachments/assets/49568a30-460a-438e-8d3f-95ff5a761a1a" />


---


## ⚠️ Limitations

* Uses JSON files instead of a database
* Data persistence may not be reliable in cloud environments
* Not suitable for large-scale production use

---

## 🚀 Future Enhancements

* Development of a frontend interface
* Authentication and role-based access control
* Real-time monitoring and analytics dashboard

---

## 📌 Note

This project is developed as an academic system to simulate real-world disaster management scenarios and demonstrate backend system design, resource allocation, and data handling.
