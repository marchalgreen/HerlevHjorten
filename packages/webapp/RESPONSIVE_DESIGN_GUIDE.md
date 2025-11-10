# 📱 Responsive Design System Guide

**CRITICAL:** All UI components MUST be built with responsive design in mind from the start. This is not optional.

## 🎯 Core Principle: Mobile-First Design

**Always design for the smallest screen first, then enhance for larger screens.**

- ✅ Start with mobile styles (base classes)
- ✅ Add responsive modifiers for larger screens (`sm:`, `md:`, `lg:`, `xl:`)
- ❌ Never assume desktop-only usage
- ❌ Never use fixed widths without responsive alternatives

---

## 📐 Standard Breakpoints

We use Tailwind's default breakpoints with clear device targets:

| Breakpoint | Min Width | Device Target | Usage |
|------------|-----------|---------------|-------|
| **Base** (default) | 0px | Mobile phones | Default styles |
| **sm** | 640px | Large phones / Small tablets | Enhanced spacing, larger text |
| **md** | 768px | Tablets (iPad portrait) | Multi-column layouts, sidebars |
| **lg** | 1024px | Tablets (iPad landscape) / Small laptops | Full desktop features |
| **xl** | 1280px | Laptops / Desktops | Maximum layout width, optimal spacing |
| **2xl** | 1536px | Large desktops | Extra-wide layouts (optional) |

### Device-Specific Considerations

- **Mobile (0-639px)**: Single column, stacked layouts, compact spacing
- **Tablet (640-1023px)**: 2-column grids, sidebars, medium spacing
- **Desktop (1024px+)**: Multi-column grids, full feature sets, optimal spacing

---

## 📏 Responsive Spacing Scale

Use responsive spacing for padding, margins, and gaps:

```tsx
// ✅ GOOD: Responsive spacing
<div className="px-4 py-3 sm:px-6 sm:py-4 md:px-8 lg:px-12">
  Content
</div>

// ❌ BAD: Fixed spacing
<div className="px-6 py-4">
  Content
</div>
```

### Standard Spacing Patterns

| Element | Mobile | Tablet (sm) | Desktop (md+) |
|---------|--------|-------------|----------------|
| **Container padding** | `px-4 py-3` | `sm:px-6 sm:py-4` | `md:px-8 lg:px-12` |
| **Gap between sections** | `gap-4` | `sm:gap-6` | `md:gap-8` |
| **Button padding** | `px-3 py-2` | `sm:px-4 sm:py-2.5` | `md:px-5 md:py-3` |
| **Card padding** | `p-4` | `sm:p-5` | `md:p-6` |
| **Grid gaps** | `gap-2` | `sm:gap-3` | `md:gap-4` |

---

## 🔤 Responsive Typography

Text sizes must scale appropriately for readability:

```tsx
// ✅ GOOD: Responsive typography
<h1 className="text-lg sm:text-xl md:text-2xl font-semibold">
  Title
</h1>
<p className="text-sm sm:text-base md:text-lg">
  Body text
</p>

// ❌ BAD: Fixed typography
<h1 className="text-xl font-semibold">
  Title
</h1>
```

### Typography Scale

| Element | Mobile | Tablet (sm) | Desktop (md+) |
|---------|--------|-------------|---------------|
| **Page title (h1)** | `text-lg` | `sm:text-xl` | `md:text-2xl` |
| **Section title (h2)** | `text-base` | `sm:text-lg` | `md:text-xl` |
| **Body text** | `text-sm` | `sm:text-base` | `md:text-lg` |
| **Small text / Captions** | `text-xs` | `sm:text-sm` | `md:text-base` |
| **Button text** | `text-xs` | `sm:text-sm` | `md:text-base` |

---

## 🎨 Responsive Layout Patterns

### Grid Layouts

```tsx
// ✅ GOOD: Progressive grid columns
<section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
  {items.map(item => <Card key={item.id} />)}
</section>

// ❌ BAD: Fixed grid
<section className="grid grid-cols-4 gap-3">
  {items.map(item => <Card key={item.id} />)}
</section>
```

### Common Grid Patterns

| Layout | Mobile | Tablet | Desktop |
|--------|--------|--------|---------|
| **Cards grid** | `grid-cols-1` | `sm:grid-cols-2` | `lg:grid-cols-3 xl:grid-cols-4` |
| **Two-column** | `flex-col` | `md:flex-row` | `md:flex-row` |
| **Sidebar layout** | `flex-col` | `md:flex-row` | `lg:flex-row` |
| **Table columns** | `hidden` (mobile) | `sm:table-cell` | `sm:table-cell` |

### Flexbox Patterns

```tsx
// ✅ GOOD: Responsive flex direction
<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div>Left content</div>
  <div>Right content</div>
</div>

// ❌ BAD: Fixed flex direction
<div className="flex flex-row items-center justify-between">
  <div>Left content</div>
  <div>Right content</div>
</div>
```

---

## 🔘 Responsive Buttons & Interactive Elements

Buttons must be appropriately sized for touch targets on mobile:

```tsx
// ✅ GOOD: Responsive button sizing
<button className="rounded-md px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium">
  Action
</button>

// ❌ BAD: Fixed button size
<button className="rounded-md px-4 py-2 text-sm font-medium">
  Action
</button>
```

### Button Size Guidelines

- **Mobile**: Minimum 44x44px touch target (`px-3 py-2` = ~36px, add padding if needed)
- **Tablet+**: Standard sizing (`px-4 py-2.5` or `px-5 py-3`)
- **Text size**: `text-xs` on mobile, `sm:text-sm` on tablet+

---

## 📱 Component-Specific Patterns

### Headers

```tsx
// ✅ GOOD: Stacked on mobile, horizontal on desktop
<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div className="flex-1 min-w-0">
    <h1 className="text-lg sm:text-xl font-semibold">Title</h1>
  </div>
  <div className="flex flex-wrap gap-2">
    <Button>Action 1</Button>
    <Button>Action 2</Button>
  </div>
</header>
```

### Navigation

```tsx
// ✅ GOOD: Responsive navigation
<nav className="flex flex-col sm:flex-row gap-2 sm:gap-4">
  <NavItem>Link 1</NavItem>
  <NavItem>Link 2</NavItem>
</nav>
```

### Tables

```tsx
// ✅ GOOD: Responsive table (hide columns on mobile, show on tablet+)
<table className="w-full">
  <thead className="hidden sm:table-header-group">
    <tr>
      <th className="px-3 sm:px-4">Column 1</th>
      <th className="px-3 sm:px-4">Column 2</th>
    </tr>
  </thead>
  <tbody>
    {/* Mobile: Card view, Tablet+: Table view */}
  </tbody>
</table>
```

### Modals & Popups

```tsx
// ✅ GOOD: Responsive modal sizing
<div className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:w-auto sm:max-w-lg">
  Modal content
</div>
```

---

## 🧪 Testing Requirements

**Before committing any UI changes, you MUST test:**

1. **Mobile viewport** (375px width) - iPhone SE / small phones
2. **Tablet portrait** (768px width) - iPad portrait
3. **Tablet landscape** (1024px width) - iPad landscape
4. **Desktop** (1280px+ width) - Standard laptop
5. **Small laptop** (1366px width) - Common production laptop size

### Browser DevTools Testing

1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M / Cmd+Shift+M)
3. Test each breakpoint:
   - Responsive mode: 375px, 768px, 1024px, 1280px
   - Or use device presets: iPhone SE, iPad, iPad Pro

### Visual Checklist

For each breakpoint, verify:
- [ ] Text is readable (not too small, not too large)
- [ ] Buttons are appropriately sized (minimum 44px touch target on mobile)
- [ ] Spacing is consistent and not cramped
- [ ] Layout doesn't overflow horizontally
- [ ] Interactive elements are accessible (not overlapping)
- [ ] Images/media scale appropriately
- [ ] Navigation is usable (not hidden or broken)

---

## 🚫 Common Anti-Patterns to Avoid

### ❌ Fixed Widths Without Responsive Alternatives

```tsx
// BAD
<div className="w-[620px]">
  Content
</div>

// GOOD
<div className="w-full sm:max-w-[620px]">
  Content
</div>
```

### ❌ Desktop-Only Layouts

```tsx
// BAD
<div className="flex flex-row items-center justify-between">
  <div>Left</div>
  <div>Right</div>
</div>

// GOOD
<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div>Left</div>
  <div>Right</div>
</div>
```

### ❌ Hardcoded Pixel Values

```tsx
// BAD
<div style={{ width: '400px', padding: '20px' }}>
  Content
</div>

// GOOD
<div className="w-full sm:max-w-md p-4 sm:p-5">
  Content
</div>
```

### ❌ Ignoring Touch Targets

```tsx
// BAD: Too small for mobile
<button className="px-2 py-1 text-xs">
  Click me
</button>

// GOOD: Appropriate size
<button className="px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm">
  Click me
</button>
```

---

## 📋 Pre-Commit Checklist

Before committing any UI component, verify:

- [ ] **Mobile-first**: Base styles work on mobile (0-639px)
- [ ] **Tablet support**: Enhanced styles for tablet (640-1023px)
- [ ] **Desktop optimization**: Full features on desktop (1024px+)
- [ ] **Typography scales**: Text sizes are responsive
- [ ] **Spacing scales**: Padding/margins are responsive
- [ ] **Layout adapts**: Grids/flex layouts change appropriately
- [ ] **Touch targets**: Buttons/links are at least 44px on mobile
- [ ] **No horizontal overflow**: Content doesn't overflow viewport
- [ ] **Tested in DevTools**: Verified at 375px, 768px, 1024px, 1280px

---

## 🎓 Quick Reference

### Tailwind Responsive Prefixes

- `sm:` - 640px and up (tablets)
- `md:` - 768px and up (iPad portrait)
- `lg:` - 1024px and up (iPad landscape / laptops)
- `xl:` - 1280px and up (desktops)
- `2xl:` - 1536px and up (large desktops)

### Common Responsive Utilities

```tsx
// Spacing
className="px-4 sm:px-6 md:px-8"
className="gap-2 sm:gap-3 md:gap-4"

// Typography
className="text-sm sm:text-base md:text-lg"
className="text-xs sm:text-sm"

// Layout
className="flex-col sm:flex-row"
className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"

// Visibility
className="hidden sm:block"
className="block sm:hidden"

// Sizing
className="w-full sm:w-auto sm:max-w-md"
className="h-auto sm:h-64"
```

---

## 🔗 Related Documentation

- [Design Tokens Guide](./prompts/agentPrompts/design-tokens.md) - Color and styling tokens
- [Guards](./prompts/agentPrompts/guards.md) - Engineering guardrails
- [Code Organization Guide](./CODE_ORGANIZATION_GUIDE.md) - Architecture patterns

---

**Remember: Responsive design is not optional. Every component must work across all device sizes.**

