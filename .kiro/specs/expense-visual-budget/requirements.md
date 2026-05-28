# Requirements Document

## Introduction

Expense & Visual Budget is a client-side web application built with HTML, CSS, and Vanilla JavaScript. It allows users to track personal expenses by adding transactions with a name, amount, and category. The app displays a running total balance, a scrollable transaction list with delete capability, and a live pie chart showing spending distribution by category. Enhanced features include custom categories, monthly summary view, transaction sorting, spending limit alerts, and a dark/light mode toggle. All data is persisted in the browser's Local Storage — no server or backend is required.

---

## Glossary

- **App**: The Expense & Visual Budget client-side web application.
- **Transaction**: A single expense record consisting of an item name, a monetary amount, and a category.
- **Category**: A label grouping transactions (e.g., Food, Transport, Fun, or a user-defined custom label).
- **Balance**: The sum of all transaction amounts currently stored.
- **Transaction_List**: The scrollable UI component that renders all stored transactions.
- **Input_Form**: The UI form component used to create a new transaction.
- **Chart**: The pie chart component that visualises spending distribution by category.
- **Local_Storage**: The browser's `localStorage` API used as the sole persistence layer.
- **Monthly_Summary**: An aggregated view of transactions filtered to a specific calendar month and year.
- **Spending_Limit**: A user-defined monetary threshold per category above which the App highlights overspending.
- **Theme**: The visual colour scheme of the App, either light or dark.

---

## Requirements

### Requirement 1: Add a Transaction

**User Story:** As a user, I want to fill in a form with an item name, amount, and category so that I can record a new expense.

#### Acceptance Criteria

1. THE Input_Form SHALL contain a text field for item name, a numeric field for amount, and a category selector.
2. THE Input_Form SHALL pre-populate the category selector with the options: Food, Transport, and Fun.
3. WHEN the user submits the Input_Form with all fields filled and a positive amount between 0.01 and 999,999,999.99 inclusive, THE App SHALL add the Transaction to the Transaction_List and persist it to Local_Storage within 200ms.
4. WHEN the user submits the Input_Form with one or more empty or whitespace-only fields, THE Input_Form SHALL display a validation error message identifying each missing field by name and SHALL NOT add a Transaction.
5. WHEN the user submits the Input_Form with an amount that is not a positive number (zero, negative, non-numeric, or out of range), THE Input_Form SHALL display a validation error message stating the valid range and SHALL NOT add a Transaction.
6. WHEN a Transaction is successfully added, THE Input_Form SHALL reset all fields to their default empty/placeholder state without a page reload.
7. IF Local_Storage is unavailable when the user submits the Input_Form, THEN THE App SHALL display an error notification indicating the transaction could not be saved and SHALL NOT add the Transaction to the Transaction_List.

---

### Requirement 2: View and Delete Transactions

**User Story:** As a user, I want to see all my recorded expenses in a scrollable list and remove individual entries so that I can manage my transaction history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display every stored Transaction showing its item name, amount, category, and the date it was recorded.
2. THE Transaction_List SHALL be scrollable when the number of Transactions exceeds the visible area.
3. WHEN the user clicks the delete icon/button on a Transaction, THE App SHALL remove that Transaction from the Transaction_List and from Local_Storage, and re-render the Transaction_List immediately without a page reload.
4. IF Local_Storage fails when deleting a Transaction, THEN THE App SHALL display an error notification indicating the deletion could not be saved and SHALL NOT remove the Transaction from the Transaction_List.
5. IF no Transactions are stored, THEN THE Transaction_List SHALL display an empty-state message indicating there are no transactions yet.

---

### Requirement 3: Display Total Balance

**User Story:** As a user, I want to see my total spending at a glance so that I always know how much I have recorded.

#### Acceptance Criteria

1. THE App SHALL display the Balance prominently at the top of the page.
2. WHEN a Transaction is added, THE App SHALL recalculate and update the Balance immediately without a page reload.
3. WHEN a Transaction is deleted, THE App SHALL recalculate and update the Balance immediately without a page reload.
4. IF no Transactions are stored (including when Local_Storage is empty but available), THEN THE App SHALL display a Balance of 0.

---

### Requirement 4: Visualise Spending by Category

**User Story:** As a user, I want a pie chart showing how my spending is distributed across categories so that I can understand my spending patterns at a glance.

#### Acceptance Criteria

1. THE Chart SHALL render a pie chart that segments spending by Category, where each segment's size is proportional to the total amount for that Category.
2. WHEN a Transaction is added, THE Chart SHALL update automatically to reflect the new spending distribution without a page reload.
3. WHEN a Transaction is deleted, THE Chart SHALL update automatically to reflect the revised spending distribution without a page reload.
4. WHEN only one Category has transactions, THE Chart SHALL render a single full-circle segment for that Category.
5. IF no Transactions are stored, THEN THE Chart SHALL display a visible text placeholder message (e.g., "No data to display") instead of a blank or broken chart.
6. THE Chart SHALL display a legend identifying each Category with a unique colour and its percentage share of total spending.
7. WHEN a Transaction is edited, THE Chart SHALL update automatically to reflect the revised spending distribution without a page reload.
8. THE Chart SHALL exclude any Category whose total amount is zero from the rendered segments and legend.

---

### Requirement 5: Persist Data Across Sessions

**User Story:** As a user, I want my transactions to be saved so that my data is still available when I reopen the app.

#### Acceptance Criteria

1. WHEN the App initialises, THE App SHALL read all Transactions from Local_Storage and render them in the Transaction_List; IF Local_Storage is available but contains zero transactions, THE App SHALL render an empty Transaction_List.
2. WHEN the App initialises, THE App SHALL calculate the Balance from the loaded Transactions and display it; IF no Transactions are loaded, THE App SHALL display a Balance of 0.
3. WHEN the App initialises, THE App SHALL render the Chart from the loaded Transactions; IF no Transactions are loaded, THE App SHALL display the Chart empty-state placeholder.
4. IF Local_Storage is unavailable or returns malformed or structurally invalid data, THEN THE App SHALL initialise with an empty Transaction_List and display an error notification indicating the nature of the storage failure.
5. WHEN Local_Storage is available and Transactions load successfully, THE App SHALL NOT display any error notification.

---

### Requirement 6: Add Custom Categories

**User Story:** As a user, I want to create my own spending categories so that I can organise expenses beyond the default options.

#### Acceptance Criteria

1. THE App SHALL provide a control that allows the user to enter and save a custom Category name between 1 and 50 characters in length.
2. WHEN the user saves a custom Category, THE Input_Form SHALL add the new Category to the category selector immediately without a page reload.
3. WHEN the user saves a custom Category, THE App SHALL persist the custom Category to Local_Storage so that it is available in future sessions.
4. WHEN the App initialises, THE App SHALL load all previously saved custom Categories and include them in the category selector.
5. IF the user attempts to save a custom Category with an empty or whitespace-only name, THEN THE App SHALL display a validation error and SHALL NOT save the Category.
6. IF the user attempts to save a custom Category whose name (case-insensitive) already exists among default or custom Categories, THEN THE App SHALL display a duplicate error and SHALL NOT save the Category.
7. IF the number of custom Categories already stored equals 50, THEN THE App SHALL display an error indicating the maximum has been reached and SHALL NOT save the new Category.
8. IF Local_Storage is unavailable when saving a custom Category, THEN THE App SHALL display an error notification and SHALL NOT add the Category to the selector.

---

### Requirement 7: Monthly Summary View

**User Story:** As a user, I want to filter my transactions by month so that I can review spending for a specific period.

#### Acceptance Criteria

1. WHEN the user opens the Monthly_Summary view, THE App SHALL display a month/year selector defaulting to the current calendar month and year.
2. WHEN the user selects a month and year, THE App SHALL display only the Transactions whose recorded date falls within that calendar month.
3. WHEN the Monthly_Summary view is active, THE Chart SHALL reflect only the Transactions visible in the filtered view.
4. WHEN the Monthly_Summary view is active and no Transactions exist for the selected month, THE App SHALL display a visible empty-state message stating no transactions were recorded for that period.
5. WHEN the Monthly_Summary view is active and Transactions exist for the selected month, THE App SHALL display those Transactions in the Transaction_List.
6. IF a load error occurs while filtering Transactions for the selected month, THEN THE App SHALL display an error notification describing the failure and SHALL NOT render a blank or silent failure state.
7. WHEN the user clears the month/year filter, THE App SHALL return to displaying all Transactions.

---

### Requirement 8: Sort Transactions

**User Story:** As a user, I want to sort my transaction list by amount or category so that I can find and compare entries more easily.

#### Acceptance Criteria

1. THE Transaction_List SHALL provide sort controls allowing the user to sort by amount (ascending and descending) and by category (A–Z and Z–A).
2. WHEN the user selects a sort option, THE Transaction_List SHALL reorder the displayed Transactions according to the selected criterion within 200ms.
3. WHEN a new Transaction is added while a sort option is active, THE Transaction_List SHALL insert the new Transaction in the correct sorted position.
4. WHILE a sort option is active, THE sort controls SHALL display a distinct visual marker (e.g., highlighted button or arrow indicator) on the active sort control to indicate the current sort criterion and direction.
5. IF no sort option has been selected, THEN THE Transaction_List SHALL display Transactions ordered by date added, most recent first.

---

### Requirement 9: Spending Limit Alerts

**User Story:** As a user, I want to set a spending limit per category so that I am alerted when I exceed my budget for that category.

#### Acceptance Criteria

1. THE App SHALL provide a control for the user to set a Spending_Limit for each Category.
2. WHEN the user saves a Spending_Limit, THE App SHALL persist it to Local_Storage.
3. WHILE the total amount for a Category equals or exceeds its Spending_Limit, THE App SHALL apply a consistent visual indicator (distinct from the default appearance) to all Transactions belonging to that Category in the Transaction_List.
4. WHILE the total amount for a Category equals or exceeds its Spending_Limit, THE App SHALL apply a consistent visual indicator (distinct from the default appearance) to the corresponding Chart segment.
5. WHEN a Transaction is deleted or a Spending_Limit is updated and the Category total falls below the Spending_Limit, THE App SHALL remove the visual indicator for that Category within 100ms.
6. IF the user sets a Spending_Limit that is not a number between 0.01 and 999,999,999.99 inclusive, THEN THE App SHALL display a validation error and SHALL NOT save the Spending_Limit.
7. WHEN a Transaction addition or edit causes the total for a Category to first meet or exceed its Spending_Limit, THE App SHALL apply the visual indicator to all affected Transactions and the Chart segment within 100ms.

---

### Requirement 10: Dark/Light Mode Toggle

**User Story:** As a user, I want to switch between dark and light themes so that I can use the app comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE App SHALL provide a toggle control that switches the Theme between light and dark.
2. WHEN the user activates the toggle, THE App SHALL apply the selected Theme to all currently rendered and subsequently rendered UI components within 100ms without a page reload.
3. WHEN the user activates the toggle, THE App SHALL persist the selected Theme preference to Local_Storage.
4. WHEN the App initialises, THE App SHALL load the persisted Theme preference from Local_Storage and apply it before rendering any visible content.
5. IF no Theme preference is stored, THEN THE App SHALL set the Theme to light and apply it before rendering any visible content.
6. IF Local_Storage is unavailable when loading or saving the Theme preference, THEN THE App SHALL default to the light Theme for the current session without persisting the preference.

---

## Technical Constraints

- **TC-1 — Technology Stack**: THE App SHALL be implemented using HTML for structure, CSS for styling, and Vanilla JavaScript for behaviour. The App SHALL NOT use JavaScript frameworks or libraries other than a charting library (e.g., Chart.js) for the pie chart component.
- **TC-2 — Data Storage**: THE App SHALL use the browser `localStorage` API as the sole persistence mechanism. No server-side storage or external API calls SHALL be made.
- **TC-3 — Browser Compatibility**: THE App SHALL function correctly in current stable releases of Chrome, Firefox, Edge, and Safari.
- **TC-4 — File Structure**: THE App SHALL contain exactly one CSS file inside a `css/` directory and exactly one JavaScript file inside a `js/` directory.
