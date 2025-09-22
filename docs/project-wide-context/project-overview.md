# Project Unify: Overview & Core Features

**Last Updated:** September 21, 2025

## 1. Project Vision & Core Philosophy

**Vision:** To create the ultimate task and project management tool that seamlessly integrates task management, project organization, and calendar-based time-blocking into a single, intuitive interface across all major platforms.

**Core Philosophy:** Project Unify is designed for users who find existing tools either too simplistic (like basic to-do lists) or too rigid and complex (like enterprise project management software). It merges the best concepts from leading apps like Asana and Akiflow.

* **Projects as Filters, Not Silos:** Projects are treated as flexible labels or contexts that can be combined, rather than walled-off containers. This reflects the fluid nature of modern work.
* **Capture Everything, Organize Later:** The system prioritizes the rapid capture of tasks into a default "General" project, reducing friction and allowing the user to categorize later.
* **Plan with Intent:** The core workflow is centered around viewing tasks and calendar events side-by-side, enabling users to realistically plan *when* they will complete their work by dragging tasks directly onto their schedule.

### 1.1 Target Platforms

Project Unify will be developed simultaneously for Web, native macOS, and native Mobile (iOS and Android). While the core feature set will be consistent across all platforms, the user interface will be adapted to provide an optimal experience for each form factor.

* **Web & macOS:** Will feature the full three-column layout for a comprehensive "mission control" view.
* **Mobile (iOS & Android):** Will use a tab-based or stacked navigation model to present the Projects, Task Hub, and Calendar views in a touch-friendly interface.

## 2. Jobs to be Done (JTBD)

This application serves the following core user needs:

* **Capture:** When an idea or task comes to mind, I want to capture it in less than 5 seconds with minimal clicks, so I don't lose the thought or break my current focus.
* **Plan:** When I'm planning my day or week, I want to see all my commitments (tasks and events) in one view, so I can make realistic decisions about what to work on and when.
* **Focus:** When I'm working on a specific project, I want to easily filter out all irrelevant information, so I can concentrate on the tasks at hand.
* **Organize:** When I have different types of work (e.g., bug tracking vs. grocery lists), I want to customize the properties and layout for each type, so the system adapts to my specific workflow.
* **Collaborate:** When I'm working with a team on a project, I want to share a specific set of tasks and their context easily, so we can stay aligned without sharing my entire personal workspace.

## 3. Core Features & User Flow: The Three-Column Layout

The primary user interface for desktop and web is a persistent three-column layout designed for maximum context and efficiency.

### **Column 1: Navigation & Filtering Pane (The "What")**

This is a narrow, static sidebar for project-based navigation.

* **Project List:** A simple, clean list of all projects the user has created or been invited to.
* **"General" Project:** A special, non-deletable project created for every user. It appears at the top of the project list and serves as the default destination for new tasks.
* **Functionality:**
    * Users can create, rename, and delete their own projects.
    * Clicking a single project filters the Task Hub (Column 2) to show only tasks from that project.
    * Holding `Ctrl/Cmd` and clicking multiple projects will show a combined view of all tasks from the selected projects.

### **Column 2: The Task Hub (The "How")**

This is the central and most interactive column. It is divided into three horizontal rows.

* **Top Row: Quick-Add Bar**
    * A prominent text input field is always visible.
    * **User Flow:** A user types a task name (e.g., "Draft marketing email") and hits `Enter`. The task is instantly created with default properties (`projectId`: currentUser.generalProjectId, `assignedTo`: currentUser) and appears in the Task View below.
    * **Expanded Properties:** A small button (`+` or `...`) allows the user to set properties *before* creating the task, including `Project`, `Due Date`, and `Assignee`.
    * **"Sticky" Properties:** The system will remember the properties set on the last task. If a user creates a task for the "Work" project with a due date of tomorrow, the next task they create from the Quick-Add bar will default to those same properties.

* **Middle Row: The Task View**
    * This is the primary list of tasks, which dynamically updates based on the filters selected in Column 1 and the saved view selected in the Bottom Row.
    * It defaults to showing "All Tasks" assigned to the user, regardless of project.
    * Each task in the list is draggable.

* **Bottom Row: Saved Views**
    * This is the personalization layer. A user can save a specific combination of filters and display settings as a "View".
    * **User Flow:** A user selects the "Work" and "Side Hustle" projects in Column 1. They then choose to group the tasks by "Project" and display them as a "List". They can click a "Save View" button and name it "My To-Dos".
    * This row then displays tabs for each saved view (e.g., `[All Tasks]`, `[My To-Dos]`, `[Bugs Kanban]`, `[Groceries]`). Clicking a tab instantly re-configures the Task View.
    * **View Types:** Initial view types to support are `List` and `Kanban`.
        * **List:** A standard to-do list with configurable columns (e.g., Due Date, Assignee, Custom Properties). Can be grouped by Project, Due Date, etc.
        * **Kanban:** A board view where tasks are cards that can be dragged between columns. Columns are based on a custom "Status" property.

### **Column 3: Calendar & Time-Blocking Pane (The "When")**

This column provides a visual representation of the user's time.

* **Google Calendar Integration:** The app must have a robust, two-way sync with the user's Google Calendar. Events created in either application should appear in both.
* **Calendar Display:** The user can toggle between a `Day` and `Week` view.
* **"Work Time" Blocks:** Users can create generic "Work Time" or "Focus Time" blocks directly on the calendar. This is a distinct event type.
    * **User Flow:** The user clicks and drags on an empty calendar slot (e.g., 3 PM - 5 PM on Tuesday). A "Work Time" block is created.
* **Drag-and-Drop Task Scheduling:** This is the key planning workflow.
    * **User Flow:** The user sees the task "Draft marketing email" in Column 2. They drag this task and drop it onto the "Work Time" block in Column 3. The task now appears as a checklist item inside that calendar block. This action does not schedule the task as a separate calendar event but links it to the time block.

## 4. Advanced Concepts

### Custom Properties

* **Project-Scoped:** Custom properties are defined at the **project level**. A project like "Bugs" can have a `select` property called "Environment" with options `QA` and `Prod`. A "Groceries" project would not have this property.
* **Dynamic UI:** When multiple projects with different custom properties are selected (e.g., Bugs and Side Hustle), the Task View will display a superset of all available property columns. For any given task, the fields for properties not belonging to its project will simply be empty.

### Collaboration

* **Project-Based Sharing:** Users can invite collaborators on a per-project basis by entering their email address.
* **Shared Context:** An invitation grants the collaborator access to all tasks and the specific custom property schema associated with that project.

## 5. Proposed Data Model

### Core Entities

```json
// Users
{
  "userId": "string (PK)",
  "email": "string",
  "name": "string",
  "googleAuthToken": "string (encrypted)"
}

// Projects
{
  "projectId": "string (PK)",
  "projectName": "string",
  "ownerId": "string (FK to Users)",
  "createdAt": "timestamp"
}

// Tasks
{
  "taskId": "string (PK)",
  "taskName": "string",
  "description": "string (markdown, nullable)",
  "createdAt": "timestamp",
  "createdBy": "string (FK to Users)",
  "assignedTo": "string (FK to Users)",
  "projectId": "string (FK to Projects)",
  "dueDate": "date (nullable)",
  "status": "string (e.g., 'To-Do', 'Done')"
}

// Project_Collaborators (Join Table)
{
    "projectId": "string (FK)",
    "userId": "string (FK)"
}
Views & Scheduling
JSON

// Views
{
  "viewId": "string (PK)",
  "userId": "string (FK to Users)",
  "viewName": "string",
  "viewType": "string ('list' or 'kanban')",
  "config": {
    "projectIds": ["id1", "id2"],
    "groupBy": "project",
    "sortBy": "dueDate",
    "visibleProperties": ["propId1", "propId2"]
  }
}

// TimeBlocks
{
  "blockId": "string (PK)",
  "userId": "string (FK to Users)",
  "googleCalendarEventId": "string",
  "startTime": "timestamp",
  "endTime": "timestamp",
}
Custom Properties
JSON

// ProjectProperties (The property template/definition)
{
  "propertyId": "string (PK)",
  "projectId": "string (FK to Projects)",
  "propertyName": "string", // e.g., "Environment"
  "propertyType": "string", // e.g., "select", "text", "date"
  "options": ["QA", "Prod", "Staging"] // (for 'select' type)
}

// TaskPropertyValues (The value for a specific task instance)
{
  "valueId": "string (PK)",
  "taskId": "string (FK to Tasks)",
  "propertyId": "string (FK to ProjectProperties)",
  "value": "string" // e.g., "Prod"
}
6. Out of Scope for V1
The initial build should focus on perfecting the core experience. The following features will be considered for future versions:

Recurring tasks

Task dependencies

Advanced notifications

Time tracking