# Form State Management

## Problem: Stale Form State

After updating data, form inputs often retain old values, making it impossible to edit again without refreshing.

```typescript
// ❌ BAD: Input state never updates
const [nameInput, setNameInput] = useState(user?.name || "");
// After user data updates, nameInput still has old value
// Clicking edit again shows stale data
```

## Solution: Sync Input State with Store

### Pattern 1: Basic Input Sync

```typescript
// ✅ GOOD: Sync input with store data
const [nameInput, setNameInput] = useState(user?.name || "");

useEffect(() => {
  setNameInput(user?.name || "");
}, [user?.name]);
// Input always reflects current user data
```

**Flow:**

1. User clicks edit → `setIsEditing(true)`
2. Input shows current `nameInput` value
3. User updates store → `user?.name` changes
4. useEffect runs → `setNameInput` updates input
5. User clicks edit again → Input shows fresh data

### Pattern 2: Multiple Input Sync

```typescript
// ✅ GOOD: Sync multiple inputs
const [nameInput, setNameInput] = useState(user?.name || "");
const [phoneInput, setPhoneInput] = useState(user?.phone || "");
const [emailInput, setEmailInput] = useState(user?.email || "");

useEffect(() => {
  setNameInput(user?.name || "");
  setPhoneInput(user?.phone || "");
  setEmailInput(user?.email || "");
}, [user?.name, user?.phone, user?.email]);
// All inputs stay in sync
```

### Pattern 3: Conditional Sync

```typescript
// ✅ GOOD: Only sync when not editing
const [nameInput, setNameInput] = useState(user?.name || "");
const [isEditing, setIsEditing] = useState(false);

useEffect(() => {
  // Only sync when not editing (preserve user's edits)
  if (!isEditing) {
    setNameInput(user?.name || "");
  }
}, [user?.name, isEditing]);
// Preserves user's edits while editing
```

## Form Reset Patterns

### Pattern 1: Reset on Cancel

```typescript
// ✅ GOOD: Reset input on cancel
<button
  type="button"
  onClick={() => {
    setIsEditing(false);
    setError("");
    setNameInput(user?.name || ""); // Reset to saved value
  }}
>
  Cancel
</button>
```

**Why this works:**

- User's edits are discarded
- Input shows the last saved value
- Ready for next edit

### Pattern 2: Reset on Success

```typescript
// ✅ GOOD: Reset after successful update
useEffect(() => {
  if (state?.success) {
    setIsEditing(false);
    setError("");

    // Update store (which triggers input sync)
    if (state.data?.user) {
      setUser(state.data.user);
      // Input will sync via the other useEffect
    }
  }
}, [state, setUser]);
```

### Pattern 3: Reset on Error

```typescript
// ✅ GOOD: Keep input on error for retry
useEffect(() => {
  if (state?.error) {
    setError(state.error);
    // Don't reset input - user can fix and retry
  }
}, [state?.error]);
```

## Input Validation Patterns

### Pattern 1: Real-time Validation

```typescript
// ✅ GOOD: Validate as user types
<input
  type="text"
  name="name"
  value={nameInput}
  onChange={(e) => {
    setNameInput(e.target.value);
    setError(""); // Clear error on change

    // Real-time validation
    if (e.target.value.trim().length < 2) {
      setError("Name must be at least 2 characters");
    }
  }}
/>
```

### Pattern 2: Submit Validation

```typescript
// ✅ GOOD: Validate on submit
<form
  action={formAction}
  onSubmit={(e) => {
    // Validate before submit
    if (nameInput.trim().length < 2) {
      e.preventDefault();
      setError("Name must be at least 2 characters");
      return;
    }

    setError("");
    // Form submits
  }}
>
  {/* form fields */}
</form>
```

### Pattern 3: Async Validation

```typescript
// ✅ GOOD: Validate uniqueness
<input
  type="email"
  name="email"
  value={emailInput}
  onChange={async (e) => {
    setEmailInput(e.target.value);
    setError("");

    // Check if email exists
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("email", e.target.value)
      .neq("id", userId)
      .maybeSingle();

    if (data) {
      setError("Email already in use");
    }
  }}
/>
```

## Complete Form Component Example

```typescript
"use client";

import { useState, useEffect } from "react";
import { useActionState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { updateUserProfile } from "@/app/actions/auth";

export default function ProfileForm() {
  const { user, setUser } = useAuthStore();
  const userDatabaseId = user?.user_id ?? "";

  // Edit states
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  // Input states
  const [nameInput, setNameInput] = useState(user?.name || "");
  const [phoneInput, setPhoneInput] = useState(user?.phone || "");

  // Error states
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  // Server action
  const [state, formAction, isPending] = useActionState(
    updateUserProfile,
    undefined,
  );

  // Sync inputs with store data
  useEffect(() => {
    setNameInput(user?.name || "");
    setPhoneInput(user?.phone || "");
  }, [user?.name, user?.phone]);

  // Handle server action success
  useEffect(() => {
    if (state?.success) {
      setIsEditingName(false);
      setIsEditingPhone(false);
      setNameError("");
      setPhoneError("");

      if (state.data?.user) {
        setUser({
          user_id: state.data.user.id,
          name: state.data.user.name,
          phone: state.data.user.phone,
          // ... other fields
        });
      }
    }
  }, [state, setUser]);

  // Handle server action error
  useEffect(() => {
    if (state?.error) {
      if (isEditingPhone) {
        setPhoneError(state.error);
      } else if (isEditingName) {
        setNameError(state.error);
      }
    }
  }, [state?.error, isEditingPhone, isEditingName]);

  // Name form
  const renderNameForm = () => {
    if (!isEditingName) {
      return (
        <div className="flex justify-between items-center">
          <p>{user?.name || "No name"}</p>
          <button onClick={() => setIsEditingName(true)}>Edit</button>
        </div>
      );
    }

    return (
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="userId" value={userDatabaseId} />
        <input
          type="text"
          name="name"
          value={nameInput}
          onChange={(e) => {
            setNameInput(e.target.value);
            setNameError("");
          }}
          placeholder="Enter your name"
          disabled={isPending}
          className="w-full px-3 py-2 border rounded"
        />
        {nameError && <p className="text-red-500 text-sm">{nameError}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending || nameInput.trim().length < 2}
            className="flex-1 px-4 py-2 bg-green-500 text-white rounded"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsEditingName(false);
              setNameError("");
              setNameInput(user?.name || "");
            }}
            disabled={isPending}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  };

  // Phone form (similar pattern)
  const renderPhoneForm = () => {
    if (!isEditingPhone) {
      return (
        <div className="flex justify-between items-center">
          <p>{user?.phone || "No phone"}</p>
          <button onClick={() => setIsEditingPhone(true)}>Edit</button>
        </div>
      );
    }

    return (
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="userId" value={userDatabaseId} />
        <input
          type="tel"
          name="phone"
          value={phoneInput}
          onChange={(e) => {
            setPhoneInput(e.target.value);
            setPhoneError("");
          }}
          placeholder="Enter your phone"
          disabled={isPending}
          className="w-full px-3 py-2 border rounded"
        />
        {phoneError && <p className="text-red-500 text-sm">{phoneError}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 px-4 py-2 bg-green-500 text-white rounded"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsEditingPhone(false);
              setPhoneError("");
              setPhoneInput(user?.phone || "");
            }}
            disabled={isPending}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  };

  return (
    <div className="space-y-4">
      <div className="border rounded p-4">
        <h3 className="font-bold mb-3">Name</h3>
        {renderNameForm()}
      </div>

      <div className="border rounded p-4">
        <h3 className="font-bold mb-3">Phone</h3>
        {renderPhoneForm()}
      </div>
    </div>
  );
}
```

## State Management Checklist

- [ ] Input state initialized with current user data
- [ ] useEffect syncs input with store data
- [ ] Cancel button resets input to saved value
- [ ] Success handler updates store
- [ ] Error handler shows message but keeps input
- [ ] Validation runs before submit
- [ ] Loading state disables inputs
- [ ] Multiple edits work correctly

## Common Mistakes

### ❌ Mistake 1: Not Syncing Input

```typescript
// Input never updates after first change
const [nameInput, setNameInput] = useState(user?.name || "");
// No useEffect to sync!
```

### ❌ Mistake 2: Not Resetting on Cancel

```typescript
// User's edits persist after cancel
<button onClick={() => setIsEditing(false)}>
  Cancel
</button>
// nameInput still has edited value
```

### ❌ Mistake 3: Resetting on Every Change

```typescript
// Input resets while user is typing
useEffect(() => {
  setNameInput(user?.name || "");
}, [user?.name, nameInput]); // nameInput in dependencies!
```

### ❌ Mistake 4: Not Clearing Errors

```typescript
// Error persists after user starts typing
<input
  onChange={(e) => {
    setNameInput(e.target.value);
    // Error not cleared!
  }}
/>
```

## Key Takeaways

1. **Always sync inputs with store** - Use useEffect
2. **Reset on cancel** - Discard user edits
3. **Clear errors on change** - Give user feedback
4. **Validate before submit** - Prevent invalid data
5. **Preserve edits on error** - Let user retry
6. **Test multiple edits** - Ensure state resets properly
