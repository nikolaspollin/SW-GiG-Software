# SW-GiG-Software

**GIG – Gast-Interface für die Gastronomie** is a browser-based system for table ordering and restaurant service workflows. Guests order through a QR code at their table or through service staff. Kitchen and bar work from a shared order flow, and managers maintain the menu, staff and operational reports.

Team: Timo, Niki, Paul, Basti and Johannes.

## Overview

| Folder      | Content                                                                                  |
|-------------|------------------------------------------------------------------------------------------|
| `backend/`  | Spring Boot 4 (Java 25) REST backend: Spring Web MVC, Spring Data JPA, Spring Security, Bean Validation. MySQL and PostgreSQL drivers are included. |
| `frontend/` | Angular 22 (TypeScript) single-page application used by guests and staff.                |
| `docs/`     | Project documentation.                                                                   |
| `misc/`     | Product backlog (`misc/trello-import/SE_GiG_ProductBacklog.xlsx`) and the script that imports it into Trello (`misc/trello-import`). |

### Running locally

```bash
# Backend
cd backend
./mvnw spring-boot:run

# Frontend (in a second terminal)
cd frontend
npm install
npm start        # ng serve
```

## Users

| Role          | What they need                                                                 |
|---------------|--------------------------------------------------------------------------------|
| Guest         | Order at their own pace, see prices, extras, availability and order progress, and ask for help. |
| Service staff | Manage tables and visits, take orders for guests, amend orders and deliver food and drinks. |
| Kitchen staff | A structured station queue, controlled order changes and clear readiness reporting. |
| Bar staff     | A drinks queue separate from the food workflow, with independent delivery.      |
| Manager       | Central control of menu, staff, billing and reports.                           |

## Core features

The product backlog contains 20 functional features (F01–F20) with 40 user stories, and 5 non-functional requirements (T01–T05). Priorities follow MoSCoW.

### Restaurant setup
- **Staff and roles (F01):** managers create, edit and deactivate staff accounts and assign roles. Staff accept an invitation and maintain their own account.
- **Rooms and tables (F02):** manage rooms and tables, and view and update table occupancy on a floor view.
- **QR access and dining sessions (F03):** create, rotate and revoke QR access tokens per table, and open and close dining sessions so orders belong to the right visit.

### Menu
- **Menu structure (F05):** menu categories and serving-time schedules. Guests browse the menu by category and by what is currently offered.
- **Products (F06):** manage dishes and drinks with prices. Kitchen and bar mark items as available or sold out.
- **Extras and allergens (F07):** manage extras (with surcharge and maximum quantity) and allergens. Guests filter dishes and see the total price.

### Ordering
- **Cart / order draft (F09):** guests, or service staff on their behalf, assemble an order before sending it.
- **Order submission (F10):** atomic order submission with price snapshots, a confirmation for the guest and confirmation messages by email.
- **Order amendments (F11):** pending changes to an order. The affected station approves or rejects them, and the original order stays intact.
- **Service requests (F04):** guests ask for assistance and staff work through a request queue.

### Kitchen and bar
- **Preparation stations and routing (F15):** configure stations and routing rules, and maintain workload and availability.
- **Kitchen tickets (F13) and drink tickets (F14):** separate queues for food and drinks. Service sees ready items and confirms delivery.

### Management
- **Reports (F17):** save operational reports and send them by email.
- **Feedback (F18):** guests leave feedback on their visit and managers follow it up.
- **Billing (F19):** create and void bills and payment records, review adjustments and authorise session closure.

### AI-assisted features (priority "Could Have")
These use an external generative AI REST API.
- **Service request categories (F04):** suggested categories, with the original message kept.
- **Menu texts (F08):** drafts for descriptions and translations, reviewed before a manager publishes them.
- **Order clarification (F12):** drafts for clarifying ambiguous order notes.
- **Batch suggestions (F16):** preparation batching and queue priority suggestions.
- **Report summaries (F20):** summaries of saved reports and improvement actions.

### Non-functional requirements
- **T01:** secure sign-in with role-based access.
- **T02:** menu screens in German and English.
- **T03:** safe retry of order submission during connection problems.
- **T04:** timely queue updates for kitchen and bar.
- **T05:** reproducible and documented deployment.

## Product backlog

The full backlog (user stories, owners, sprints, acceptance criteria) is in `misc/trello-import/SE_GiG_ProductBacklog.xlsx`, sheet `PB Items`. The same folder contains a script that imports it into a Trello board (see its `README.md`).
