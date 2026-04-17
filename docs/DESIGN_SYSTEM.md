# Design System Guide - Booking Haircut App

## Overview
A unified design system applied across all web applications (Admin, Owner, Manager) to ensure consistent UI/UX across the platform.

---

## Color Palette

### Primary Colors
```css
--color-primary: #f5a623;           /* Orange - Main brand color */
--color-primary-hover: #e6951a;     /* Darker orange for hover */
--color-primary-text: #ffffff;      /* Text on primary */
```

### Navigation
```css
--color-navbar-bg: #1a2e4a;         /* Dark navy for navbar */
--color-navbar-text: #ffffff;       /* White text in navbar */
--color-navbar-active: #f5a623;     /* Active nav item color */
```

### Background
```css
--color-bg-page: #f0f2f5;           /* Light gray page background */
--color-bg-card: #ffffff;           /* White card background */
--color-bg-section-header: #1a2e4a; /* Dark section headers */
--color-section-header-text: #ffffff;
```

### Text Colors
```css
--color-text-primary: #1a2e4a;      /* Main dark text */
--color-text-secondary: #6b7280;    /* Gray secondary text */
--color-text-muted: #9ca3af;        /* Lighter muted text */
```

### Status Colors
```css
--color-success: #16a34a;           /* Green */
--color-warning: #d97706;           /* Amber/Orange */
--color-danger: #dc2626;            /* Red */
--color-info: #2563eb;              /* Blue */
```

### Borders & Radius
```css
--color-border: #e5e7eb;            /* Light gray borders */
--border-radius-card: 12px;         /* Card corners */
--border-radius-badge: 6px;         /* Badge corners */
--border-radius-button: 8px;        /* Button corners */
```

### Shadows
```css
--shadow-card: 0 1px 4px rgba(0, 0, 0, 0.08);     /* Subtle shadow */
--shadow-hover: 0 4px 12px rgba(0, 0, 0, 0.1);    /* Hover shadow */
```

---

## Typography

### Font Sizes & Weights
- **Page Title**: 24px, font-weight 700
- **Section Title**: 18px, font-weight 600
- **Stat Value**: 28px, font-weight 700
- **Normal Text**: 14px, font-weight 400
- **Small Text**: 13px, font-weight 400
- **Badge/Label**: 12px, font-weight 500
- **Uppercase**: 13px, font-weight 600, text-transform uppercase

---

## Components

### Cards / Sections
```html
<div class="card">
  <h2 class="section-title">Card Title</h2>
  <p class="section-description">Optional description</p>
  <p>Card content...</p>
</div>
```

**Styling:**
- White background with 12px radius
- 20px padding
- Subtle shadow
- 24px margin bottom

---

### Stat Cards
```html
<div class="stat-grid">
  <div class="stat-card">
    <div class="stat-value">1,234</div>
    <div class="stat-label">Total Appointments</div>
  </div>
</div>
```

**Styling:**
- Consistent 120px minimum height
- Grid layout with auto-fit columns
- Center-aligned content

---

### Badges

#### Success Badge (Completed, Available, In Stock)
```html
<span class="badge badge-success">Completed</span>
```

#### Warning Badge (Pending, Low Stock, On Leave)
```html
<span class="badge badge-warning">Pending</span>
```

#### Danger Badge (Cancelled, Out of Stock, Inactive)
```html
<span class="badge badge-danger">Cancelled</span>
```

#### Info Badge (Confirmed, Multiple Bookings)
```html
<span class="badge badge-info">Confirmed</span>
```

#### Gray Badge (Bio, Style, Unknown)
```html
<span class="badge badge-gray">Modern Barber</span>
```

---

### Buttons

#### Primary Button
```html
<button class="btn btn-primary">Save Changes</button>
```

#### Secondary Button
```html
<button class="btn btn-secondary">Cancel</button>
```

#### Danger Button
```html
<button class="btn btn-danger">Delete</button>
```

---

### Form Inputs
```html
<input type="text" placeholder="Enter text...">
<select>
  <option>Select option</option>
</select>
<textarea placeholder="Enter description..."></textarea>
```

**Auto-styled with:**
- Border: 1px solid gray
- Padding: 8px 12px
- Radius: 8px
- Focus: orange border + subtle shadow

---

### Tables

```html
<div class="table-container">
  <table>
    <thead>
      <tr>
        <th>Column 1</th>
        <th>Column 2</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Data 1</td>
        <td>Data 2</td>
      </tr>
    </tbody>
  </table>
</div>
```

**Styling:**
- Header: gray background, uppercase text
- Rows: alternating hover effect
- Padding: 12px 16px per cell

---

### Toast Notifications

```html
<div class="toast-container">
  <div class="toast toast-success">✓ Successfully saved!</div>
  <div class="toast toast-error">✕ Error occurred!</div>
  <div class="toast toast-warning">⚠ Warning message</div>
  <div class="toast toast-info">ℹ Info message</div>
</div>
```

**Styling:**
- Fixed bottom-right position
- Auto-dismiss after 3 seconds
- Slide-in animation

---

## Spacing

```css
--spacing-section: 24px;    /* Between major sections */
--spacing-card: 20px;       /* Inside cards */
```

---

## Implementation Guidelines

### ✅ DO:
- Use CSS variables for all colors
- Apply consistent spacing
- Use badge classes for status
- Use button classes instead of inline styles
- Use semantic HTML

### ❌ DON'T:
- Hardcode colors (use variables instead)
- Create custom button styles (use btn-* classes)
- Mix color systems (don't use --bb-yellow and primary together)
- Create new badge classes (use existing ones)

---

## Examples

### Manager Dashboard Card
```tsx
<div className="card">
  <h2 className="section-title">Appointments Today</h2>
  <p className="section-description">All confirmed appointments</p>
  
  <div className="stat-grid">
    <div className="stat-card">
      <div className="stat-value">12</div>
      <div className="stat-label">Total</div>
    </div>
    <div className="stat-card">
      <div className="stat-value">10</div>
      <div className="stat-label">Confirmed</div>
    </div>
  </div>
  
  <button className="btn btn-primary">View Schedule</button>
</div>
```

### Status Badge Examples
```tsx
<span className="badge badge-success">Completed</span>
<span className="badge badge-warning">Pending</span>
<span className="badge badge-danger">Cancelled</span>
<span className="badge badge-info">Confirmed</span>
<span className="badge badge-gray">Modern Style</span>
```

### Form Section
```tsx
<div className="card">
  <h2 className="section-title">Edit Profile</h2>
  
  <input type="text" placeholder="Full Name" />
  <select>
    <option>Choose role...</option>
  </select>
  
  <div style={{ marginTop: '20px' }}>
    <button className="btn btn-primary">Save</button>
    <button className="btn btn-secondary">Cancel</button>
  </div>
</div>
```

---

## Status Mapping

### Appointment Status
| Status | Badge Class |
|---|---|
| completed | .badge-success |
| confirmed | .badge-info |
| pending | .badge-warning |
| in_progress | .badge-info |
| cancelled | .badge-danger |

### Barber Status
| Status | Badge Class |
|---|---|
| available | .badge-success |
| off | .badge-warning |

### Shop Order Status
| Status | Badge Class |
|---|---|
| delivered | .badge-success |
| confirmed | .badge-info |
| pending | .badge-warning |
| shipping | .badge-info |
| cancelled | .badge-danger |

### Product Stock
| Status | Badge Class |
|---|---|
| > 20 units | .badge-success |
| 5-20 units | .badge-warning |
| < 5 units | .badge-danger |
| 0 units | .badge-danger |

---

## Files Using Design System
- ✅ [admin-web/src/app/globals.css](../admin-web/src/app/globals.css)
- ✅ [owner-web/src/app/globals.css](../owner-web/src/app/globals.css)
- ✅ [manager-web/src/app/globals.css](../manager-web/src/app/globals.css)

---

## Updates & Maintenance

If you need to:
- **Change a color**: Update the CSS variable in all 3 globals.css files
- **Adjust spacing**: Modify `--spacing-section` and `--spacing-card`
- **Add new status colors**: Add new `--color-status-*` variables and `.badge-status` class
- **Update button style**: Modify `.btn`, `.btn-primary`, etc. classes

---

## Support

For questions about the design system:
1. Check this guide first
2. Review existing component implementations
3. Use CSS variables consistently
4. Keep styling in CSS, not inline styles

