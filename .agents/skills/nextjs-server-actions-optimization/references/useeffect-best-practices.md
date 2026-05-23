# useEffect Best Practices

## Problem: Unnecessary Re-renders

A common issue is including too many dependencies in `useEffect`, causing it to run more often than needed.

```typescript
// ❌ BAD: Too many dependencies
useEffect(() => {
  if (state?.success) {
    setIsEditing(false);
    setError("");
  }
}, [state, isEditing, isPending, user, setUser, formAction, userDatabaseId]);
// This effect runs every time ANY of these change!
```

## Solution: Minimal Dependencies

Only include values that the effect actually uses and that should trigger re-runs.

### Pattern 1: State Update Effect

```typescript
// ✅ GOOD: Only essential dependencies
useEffect(() => {
  if (state?.success) {
    setIsEditing(false);
    setError("");

    if (state.data?.user) {
      setUser(state.data.user);
    }
  }
}, [state, setUser]);
// Only runs when state or setUser changes
```

**Why this works:**

- `state` is the trigger - when server action completes, state changes
- `setUser` is a stable function from Zustand (doesn't change)
- `isEditing` is not used in the effect, so it shouldn't be a dependency
- `isPending` is not used in the effect, so it shouldn't be a dependency

### Pattern 2: Data Sync Effect

```typescript
// ✅ GOOD: Sync input with store data
useEffect(() => {
  setNameInput(user?.name || "");
  setPhoneInput(user?.phone || "");
}, [user?.name, user?.phone]);
// Only runs when name or phone changes
```

**Why this works:**

- We only care about `user?.name` and `user?.phone` changing
- We don't need the entire `user` object as a dependency
- This prevents unnecessary syncs when other user properties change

### Pattern 3: Error Handling Effect

```typescript
// ✅ GOOD: Separate effect for error handling
useEffect(() => {
  if (state?.error) {
    if (isEditingPhone) {
      setPhoneError(state.error);
    } else if (isEditingName) {
      setNameError(state.error);
    }
  }
}, [state?.error, isEditingPhone, isEditingName]);
// Only runs when error or editing state changes
```

**Why this works:**

- We only depend on `state?.error` (not the entire state)
- We need `isEditingPhone` and `isEditingName` to determine which error to show
- This is a separate concern from the success handler

## Dependency Analysis

### ❌ Anti-Pattern: Including Everything

```typescript
useEffect(() => {
  // logic
}, [
  state,
  isEditing,
  isPending,
  user,
  setUser,
  formAction,
  userDatabaseId,
  nameInput,
  phoneInput,
  nameError,
  phoneError,
  // ... more
]);
// This effect runs constantly!
```

### ✅ Pattern: Minimal Dependencies

```typescript
// Effect 1: Handle server action response
useEffect(() => {
  if (state?.success) {
    // Update store and close edit mode
  }
}, [state, setUser]);

// Effect 2: Sync input with store
useEffect(() => {
  setNameInput(user?.name || "");
}, [user?.name]);

// Effect 3: Handle errors
useEffect(() => {
  if (state?.error) {
    setError(state.error);
  }
}, [state?.error]);
```

## Common Dependency Mistakes

### Mistake 1: Including Unused Variables

```typescript
// ❌ BAD
useEffect(() => {
  if (state?.success) {
    setIsEditing(false);
  }
}, [state, isEditing, isPending, user]);
// isEditing, isPending, user are not used in the effect!
```

```typescript
// ✅ GOOD
useEffect(() => {
  if (state?.success) {
    setIsEditing(false);
  }
}, [state]);
// Only state is used
```

### Mistake 2: Including Entire Objects When You Only Need Properties

```typescript
// ❌ BAD
useEffect(() => {
  setNameInput(user.name);
}, [user]);
// Runs every time ANY user property changes
```

```typescript
// ✅ GOOD
useEffect(() => {
  setNameInput(user?.name || "");
}, [user?.name]);
// Only runs when name changes
```

### Mistake 3: Including Derived Values

```typescript
// ❌ BAD
const userName = user?.name || "Guest";
useEffect(() => {
  setInput(userName);
}, [userName, user]);
// userName is derived from user, so including both is redundant
```

```typescript
// ✅ GOOD
useEffect(() => {
  setInput(user?.name || "Guest");
}, [user?.name]);
// Only depend on the source
```

### Mistake 4: Including Callback Functions

```typescript
// ❌ BAD
const handleUpdate = () => {
  // logic
};

useEffect(() => {
  if (state?.success) {
    handleUpdate();
  }
}, [state, handleUpdate]);
// handleUpdate is recreated every render!
```

```typescript
// ✅ GOOD
useEffect(() => {
  if (state?.success) {
    // Put logic directly in effect
    setIsEditing(false);
    setError("");
  }
}, [state]);
// No callback needed
```

## Dependency Checking Checklist

For each dependency, ask:

1. **Is it used in the effect?** If no, remove it.
2. **Does it need to trigger the effect?** If no, remove it.
3. **Is it a derived value?** If yes, depend on the source instead.
4. **Is it a stable function?** If yes, it's safe to include (or use useCallback).
5. **Is it a primitive or object?** If object, consider depending on specific properties.

## Real-World Example

### Complete Profile Update Component

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
  const [nameInput, setNameInput] = useState(user?.name || "");
  const [nameError, setNameError] = useState("");

  // Server action
  const [state, formAction, isPending] = useActionState(
    updateUserProfile,
    undefined,
  );

  // Effect 1: Sync input with store data
  // ✅ Only depends on user?.name
  useEffect(() => {
    setNameInput(user?.name || "");
  }, [user?.name]);

  // Effect 2: Handle server action success
  // ✅ Only depends on state and setUser
  useEffect(() => {
    if (state?.success) {
      setIsEditingName(false);
      setNameError("");

      if (state.data?.user) {
        setUser({
          user_id: state.data.user.id,
          name: state.data.user.name,
          // ... other fields
        });
      }
    }
  }, [state, setUser]);

  // Effect 3: Handle server action error
  // ✅ Only depends on state?.error
  useEffect(() => {
    if (state?.error) {
      setNameError(state.error);
    }
  }, [state?.error]);

  return (
    <div>
      {isEditingName ? (
        <form action={formAction}>
          <input type="hidden" name="userId" value={userDatabaseId} />
          <input
            type="text"
            name="name"
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value);
              setNameError("");
            }}
            disabled={isPending}
          />
          {nameError && <p className="error">{nameError}</p>}
          <button type="submit" disabled={isPending}>
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
          >
            Cancel
          </button>
        </form>
      ) : (
        <div>
          <p>{user?.name || "No name"}</p>
          <button onClick={() => setIsEditingName(true)}>Edit</button>
        </div>
      )}
    </div>
  );
}
```

## Performance Impact

| Scenario | Dependencies | Re-renders       | Performance   |
| -------- | ------------ | ---------------- | ------------- |
| Too many | 10+          | Every change     | ❌ Slow       |
| Optimal  | 2-3          | Only when needed | ✅ Fast       |
| None     | []           | Once on mount    | ⚠️ Stale data |

## Key Takeaways

1. **Minimize dependencies** - Only include what's necessary
2. **Depend on properties, not objects** - `user?.name` not `user`
3. **Separate concerns** - Use multiple effects for different logic
4. **Check each dependency** - Ask "is this actually needed?"
5. **Use ESLint** - Enable `exhaustive-deps` rule to catch mistakes
6. **Prefer stable functions** - From Zustand, useCallback, or move outside component
