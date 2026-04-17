# Implementation Checklist - Design System

## ✅ Completed Tasks

### 1. CSS Variables & Base Styles
- ✅ Created comprehensive CSS variables in globals.css
- ✅ Implemented for all 3 apps:
  - admin-web/src/app/globals.css
  - owner-web/src/app/globals.css
  - manager-web/src/app/globals.css
- ✅ Defined color palette (primary, navbar, bg, text, status, badges)
- ✅ Defined spacing variables (section, card)
- ✅ Defined shadow effects (card, hover)
- ✅ Defined border radius (card, badge, button)

### 2. Base Component Styles
- ✅ Card/Section styling (.card, .section)
- ✅ Stat card styling (.stat-card, .stat-grid, .stat-value, .stat-label)
- ✅ Badge styling (.badge, .badge-success, .badge-warning, .badge-danger, .badge-info, .badge-gray)
- ✅ Button styling (.btn, .btn-primary, .btn-secondary, .btn-danger)
- ✅ Table styling (table, thead, tbody with hover effects)
- ✅ Form input styling (input, select, textarea with focus states)
- ✅ Toast notification styling (.toast, .toast-success, .toast-error, .toast-warning, .toast-info)

### 3. Documentation
- ✅ [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) - Main design system guide
- ✅ [COMPONENT_EXAMPLES.md](./COMPONENT_EXAMPLES.md) - Component examples & refactoring patterns
- ✅ Repository memory with design system reference
- ✅ CSS variable documentation

---

## 📋 TODO - Component Updates (Priority Order)

### Priority 1: Header/Navigation Components
- [ ] Update AdminHeader.tsx to use design system
  - Use `--color-navbar-bg` instead of hardcoded navy
  - Use `--color-navbar-text` for text
  - Use `--color-primary` for active states
  - Use `.btn-primary` and `.btn-secondary` classes

- [ ] Update OwnerSubNav.tsx
- [ ] Update ManagerDashboardNav.tsx

### Priority 2: Dashboard Stat Cards
- [ ] Update AdminDashboard page.tsx
  - Convert stat cards to use `.stat-card` class
  - Use `.stat-grid` for grid layout
  - Apply color-coding for different stat types
  - Use `.stat-value` and `.stat-label` classes

- [ ] Update OwnerAnalyticsBoard.tsx
  - Apply design system to KPI section
  - Update chart colors to use CSS variables
  - Convert button styles

- [ ] Update Manager Dashboard (if exists)

### Priority 3: Badge Components
- [ ] Create reusable Badge component
- [ ] Update all appointment status badges
- [ ] Update barber status badges
- [ ] Update product stock badges
- [ ] Update order status badges

### Priority 4: Button Components
- [ ] Create reusable Button component
- [ ] Replace all button variations with .btn-* classes
- [ ] Update form buttons
- [ ] Update action buttons (Edit, Delete, Save, Cancel)

### Priority 5: Form Components
- [ ] Verify input styling is applied automatically
- [ ] Create FormSection wrapper component
- [ ] Update all form pages to use new input styling

### Priority 6: Table Components
- [ ] Create reusable Table component
- [ ] Apply table styling to all data tables
- [ ] Add hover effects
- [ ] Update table headers to use uppercase styling

### Priority 7: Toast Notifications
- [ ] Create useToast hook
- [ ] Replace any existing toast/alert components
- [ ] Add success/error/warning notifications to forms

### Priority 8: Page Backgrounds
- [ ] Update all page backgrounds to use `--color-bg-page`
- [ ] Ensure consistent spacing with `--spacing-section`
- [ ] Apply to all main content areas

---

## 🎨 Color Mapping for Components

### Stat Cards Colors
- Success (green): Active appointments, completed orders, items in stock
- Warning (amber): Pending appointments, low stock, items on hold
- Danger (red): Cancelled appointments, out of stock, inactive items
- Info (blue): Total stats, confirmed bookings
- Default: Revenue, customer count

### Badge Mapping Examples

#### Appointments
| Status | Badge Class |
|--------|------------|
| completed | badge-success ✓ |
| confirmed | badge-info |
| pending | badge-warning |
| in_progress | badge-info |
| cancelled | badge-danger |

#### Barbers
| Status | Badge Class |
|--------|------------|
| available | badge-success |
| off | badge-warning |

#### Products
| Stock Level | Badge Class |
|------------|------------|
| > 20 units | badge-success (In Stock) |
| 5-20 units | badge-warning (Low Stock) |
| < 5 units | badge-danger (Very Low) |
| 0 units | badge-danger (Out of Stock) |

#### Orders
| Status | Badge Class |
|--------|------------|
| delivered | badge-success |
| confirmed | badge-info |
| pending | badge-warning |
| shipping | badge-info |
| cancelled | badge-danger |

---

## 📱 Responsive Considerations

✅ Already applied:
- Stat grid uses auto-fit columns: `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))`
- Max-width containers already in components
- Padding scalable with --spacing-card

📝 To verify:
- Test on mobile (< 640px)
- Test on tablet (640px - 1024px)
- Test on desktop (> 1024px)

---

## 🔄 Backward Compatibility

✅ Maintained:
- Legacy color variables still available (`--bb-yellow`, `--bb-navy`, etc.)
- Existing components will continue to work
- Gradual migration is possible

ℹ️ For new components:
- Use new color system
- Use new classes
- Refer to COMPONENT_EXAMPLES.md

---

## 📊 Testing Checklist

After implementing components, verify:
- [ ] Colors match across all 3 apps
- [ ] Spacing is consistent
- [ ] Buttons have proper hover states
- [ ] Forms display properly
- [ ] Tables look clean and readable
- [ ] Badges display correctly
- [ ] Responsive layout works on mobile

---

## 🚀 Next Steps

1. **Now**: Review this checklist and documentation
2. **Start with Priority 1**: Update Header components (easiest, most visible)
3. **Move to Priority 2**: Update dashboard stat cards
4. **Create component utilities**: Build reusable components as in COMPONENT_EXAMPLES.md
5. **Test**: Verify on all 3 apps at their respective ports

---

## 📞 Support References

- Main guide: [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
- Component patterns: [COMPONENT_EXAMPLES.md](./COMPONENT_EXAMPLES.md)
- CSS files:
  - [admin-web/src/app/globals.css](./admin-web/src/app/globals.css)
  - [owner-web/src/app/globals.css](./owner-web/src/app/globals.css)
  - [manager-web/src/app/globals.css](./manager-web/src/app/globals.css)

---

**Last Updated**: 2024-01-18
**Design System Version**: 1.0
**Status**: ✅ Ready for Implementation
