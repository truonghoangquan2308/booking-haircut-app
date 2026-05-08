# Quick Start - Design System

## 🎯 What's Ready

✅ **CSS Variables** - All 3 apps  
✅ **Component Library** - Ready to use  
✅ **Complete Documentation** - Style guide included  
✅ **Examples & Patterns** - Copy-paste ready  

---

## 📦 What You Get

### 1. Pre-Built Components
```tsx
import {
  StatCard,      // Metric displays
  Badge,         // Status indicators
  Button,        // All button types
  Card,          // Content containers
  Table,         // Data tables
  useToast,      // Notifications
  FormSection,   // Complete forms
} from "@/components/DesignSystemComponents";
```

### 2. CSS Variables
```css
--color-primary          /*  #f5a623 Orange */
--color-success          /*  #16a34a Green */
--color-warning          /*  #d97706 Yellow */
--color-danger           /*  #dc2626 Red */
--color-info             /*  #2563eb Blue */
--color-text-primary     /*  #1a2e4a Dark */
--color-bg-page          /*  #f0f2f5 Light gray */
--color-bg-card          /*  #ffffff White */
```

### 3. CSS Classes
```html
<div class="card">
  <h2 class="section-title">Title</h2>
  <p class="section-description">Description</p>
</div>

<div class="stat-grid">
  <div class="stat-card">
    <div class="stat-value">123</div>
    <div class="stat-label">Label</div>
  </div>
</div>

<span class="badge badge-success">Done</span>
<button class="btn btn-primary">Save</button>
```

---

## 🚀 3 Ways to Use

### Method 1: Use Components (Easiest)
```tsx
import { StatCard, Button } from "@/components/DesignSystemComponents";

export default function Page() {
  return (
    <div className="stat-grid">
      <StatCard label="Total" value="1,234" color="info" />
    </div>
  );
}
```

### Method 2: Use CSS Classes
```tsx
export default function Page() {
  return (
    <div className="stat-card">
      <div className="stat-value">1,234</div>
      <div className="stat-label">Total</div>
    </div>
  );
}
```

### Method 3: Use CSS Variables
```tsx
export default function Page() {
  return (
    <button
      className="btn"
      style={{
        background: 'var(--color-primary)',
        color: 'var(--color-primary-text)',
      }}
    >
      Save
    </button>
  );
}
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | **Main style guide** - colors, typography, examples |
| [COMPONENT_EXAMPLES.md](./COMPONENT_EXAMPLES.md) | **Before/after** - how to refactor existing code |
| [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md) | **Todo list** - what to update next |
| [DESIGN_SYSTEM_COMPLETE.md](./DESIGN_SYSTEM_COMPLETE.md) | **Full implementation** - summary and usage |

---

## 🎨 Common Patterns

### Stat Cards Dashboard
```tsx
<div className="stat-grid">
  <StatCard label="Users" value="234" color="info" />
  <StatCard label="Revenue" value="₫2.5M" color="success" />
  <StatCard label="Pending" value="12" color="warning" />
  <StatCard label="Errors" value="2" color="danger" />
</div>
```

### Status Badges
```tsx
<Badge status="completed">Completed</Badge>
<Badge status="pending">Pending</Badge>
<Badge status="cancelled">Cancelled</Badge>
<Badge status="confirmed">Confirmed</Badge>
```

### Button Group
```tsx
<Button variant="primary" onClick={save}>Save</Button>
<Button variant="secondary" onClick={cancel}>Cancel</Button>
<Button variant="danger" onClick={delete}>Delete</Button>
```

### Card with Form
```tsx
<Card title="Edit Profile" description="Update your info">
  <input type="text" placeholder="Full Name" />
  <input type="email" placeholder="Email" />
  <Button variant="primary" type="submit">Save</Button>
</Card>
```

### Data Table
```tsx
<Table
  headers={["Name", "Status", "Date"]}
  rows={[
    ["John Doe", <Badge status="completed">Done</Badge>, "2024-01-15"],
    ["Jane Smith", <Badge status="pending">Pending</Badge>, "2024-01-16"],
  ]}
/>
```

---

## 🔄 Converting Old Code

### Before
```tsx
<div className="bg-white rounded-lg p-4 shadow-sm">
  <h2 className="text-lg font-bold">Title</h2>
  <button className="px-4 py-2 bg-yellow-400 rounded text-black">
    Save
  </button>
</div>
```

### After
```tsx
<Card title="Title">
  <Button variant="primary">Save</Button>
</Card>
```

---

## 📋 Next Steps

1. **Read** [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) (5 min)
2. **Copy** components from `DesignSystemComponents.tsx` you need
3. **Update** components in priority order:
   - Headers (most visible)
   - Dashboards (high impact)
   - Forms (high traffic)
4. **Verify** looks good on all 3 apps

---

## 🆘 Troubleshooting

**Q: Colors not showing?**  
A: Make sure globals.css is imported in your layout.tsx

**Q: Component not found?**  
A: Check you're importing from correct app's components folder

**Q: Custom color needed?**  
A: Add CSS variable to globals.css and use it

**Q: Need different button size?**  
A: Button accepts `size="sm" | "md" | "lg"` prop

---

## 📱 Responsive Notes

✅ Already responsive:
- Stat grid auto-adjusts columns
- Tables scroll on mobile
- Buttons scale with size prop

📝 Testing:
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

---

## ⚡ Key Features

| Feature | Benefit |
|---------|---------|
| CSS Variables | Easy color changes, no hardcoding |
| Reusable Components | Save development time |
| Type-Safe | TypeScript catches errors |
| Responsive | Works on all devices |
| Accessible | Proper semantic HTML |
| Lightweight | Minimal CSS, no frameworks |
| Backward Compatible | Existing code still works |

---

## 📞 Help

**Confused about colors?**  
→ See color table in DESIGN_SYSTEM.md

**Need component pattern?**  
→ Check COMPONENT_EXAMPLES.md

**What to update first?**  
→ See IMPLEMENTATION_CHECKLIST.md

**Full details?**  
→ Read DESIGN_SYSTEM_COMPLETE.md

---

## ✅ Checklist to Get Started

- [ ] Read DESIGN_SYSTEM.md (style guide)
- [ ] Review DesignSystemComponents.tsx (available components)
- [ ] Pick a component to refactor
- [ ] Import and use in a page
- [ ] Test locally at port 3000/3001/3004
- [ ] Verify looks consistent
- [ ] Move to next component

---

## 🎉 You're All Set!

The design system is ready to use. Start with any component from `DesignSystemComponents.tsx` and enjoy consistent, beautiful UI across all three apps!

**Happy coding! 🚀**

---

*Last updated: 2024-01-18*  
*Design System v1.0*  
*Status: Ready for production*
