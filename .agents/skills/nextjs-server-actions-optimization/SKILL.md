# Next.js Server Actions Optimization Skill

## Overview

This skill documents best practices for optimizing server actions, API calls, and state management in Next.js applications. It covers patterns to avoid double API calls, proper use of `useEffect`, efficient data fetching, and seamless UI updates.

## Key Principles

### 1. **Return Data from Server Actions**

Instead of having the client refetch data after a server action completes, return the updated data directly from the server action.

**Problem:**

```typescript
// ❌ BAD: Double API call
// Server action updates DB
// Client useEffect refetches the data (2nd call)
```

**Solution:**

```typescript
// ✅ GOOD: Single API call
export async function updateUserProfile(
  _prevState: PhoneAuthState | undefined,
  formData: FormData,
): Promise<PhoneAuthState> {
  // ... validation and update logic ...

  // Update database
  const { error: updateError } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", userId);

  if (updateError) {
    return { error: updateError.message };
  }

  // Fetch updated data to return to client
  const { data: updatedUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  // Return updated data - no client refetch needed
  return {
    success: true,
    data: {
      user_id: userId,
      is_new_user: false,
      user: updatedUser, // Include full updated object
    },
  };
}
```

### 2. **Proper useEffect Dependencies**

Only include dependencies that actually affect the effect's logic. Avoid unnecessary re-renders.

**Problem:**

```typescript
// ❌ BAD: Too many dependencies, causes unnecessary re-renders
useEffect(() => {
  if (state?.success) {
    // ... update logic ...
  }
}, [state, isEditingPhone, isEditingName, userDatabaseId, setUser]);
// Every time isEditingPhone or isEditingName changes, effect runs
```

**Solution:**

```typescript
// ✅ GOOD: Only essential dependencies
useEffect(() => {
  if (state?.success) {
    // ... update logic ...
  }
}, [state, setUser]);
// Only runs when state or setUser changes
```

### 3. **Sync Input State with Store Data**

When user data updates in the store, automatically sync input fields to prevent stale values.

**Problem:**

```typescript
// ❌ BAD: Input state never updates after first change
const [nameInput, setNameInput] = useState(user?.name || "");
// After user data updates, nameInput still has old value
```

**Solution:**

```typescript
// ✅ GOOD: Sync input with user data
const [nameInput, setNameInput] = useState(user?.name || "");

useEffect(() => {
  setNameInput(user?.name || "");
  setPhoneInput(user?.phone || "");
}, [user?.name, user?.phone]);
// Input fields always reflect current user data
```

### 4. **Reset Form State on Cancel**

When canceling an edit, reset input fields to current saved values.

**Problem:**

```typescript
// ❌ BAD: Cancel doesn't reset input
<button
  onClick={() => {
    setIsEditingName(false);
    setNameError("");
    // nameInput still has the edited value
  }}
>
  Cancel
</button>
```

**Solution:**

```typescript
// ✅ GOOD: Reset input to current user data
<button
  onClick={() => {
    setIsEditingName(false);
    setNameError("");
    setNameInput(user?.name || ""); // Reset to saved value
  }}
>
  Cancel
</button>
```

### 5. **Use useActionState for Form Submission**

Leverage `useActionState` hook for proper form handling with server actions.

**Pattern:**

```typescript
const [state, formAction, isPending] = useActionState(
  updateUserProfile,
  undefined,
);

// In JSX:
<form action={formAction} className="space-y-3">
  <input type="hidden" name="userId" value={userDatabaseId} />
  <input
    type="text"
    name="name"
    value={nameInput}
    onChange={(e) => setNameInput(e.target.value)}
    disabled={isPending}
  />
  <button type="submit" disabled={isPending}>
    {isPending ? "Saving..." : "Save"}
  </button>
</form>
```

### 6. **Update Store Directly from Server Response**

Use the data returned from the server action to update your state management store.

**Pattern:**

```typescript
useEffect(() => {
  if (state?.success && state.data?.user) {
    const userData = state.data.user;

    // Update Zustand store with returned data
    setUser({
      user_id: userData.id,
      phone: userData.phone,
      name: userData.name,
      userId: userData.display_id,
      elo: userData.elo,
      level: userData.level,
      xp: userData.total_xp,
      currentXp: userData.current_xp,
      xpToNextLevel: userData.xp_to_next_level,
      streak: userData.streak,
      tier: userData.tier,
      tierBadge: userData.tier_badge,
      subscription_tier: userData.subscription_tier,
      language_pref: userData.language_pref,
      admin_flag: userData.admin_flag,
    });

    // Close edit mode
    setIsEditingName(false);
    setIsEditingPhone(false);
    setNameError("");
    setPhoneError("");
  }
}, [state, setUser]);
```

## Complete Example: Profile Update Flow

### Server Action (app/actions/auth.ts)

```typescript
export type PhoneAuthState = {
  success?: boolean;
  error?: string;
  data?: {
    user_id: string;
    is_new_user: boolean;
    user?: {
      id: string;
      phone: string;
      name: string;
      display_id: string;
      elo: number;
      level: number;
      total_xp: number;
      current_xp: number;
      xp_to_next_level: number;
      streak: number;
      tier: string;
      tier_badge: string;
      subscription_tier: string;
      language_pref: string;
      admin_flag: boolean;
    };
  };
};

export async function updateUserProfile(
  _prevState: PhoneAuthState | undefined,
  formData: FormData,
): Promise<PhoneAuthState> {
  try {
    const userId = formData.get("userId") as string;
    const nameValue = formData.get("name");
    const phoneValue = formData.get("phone");

    const name = nameValue ? (nameValue as string) : undefined;
    const phone = phoneValue ? (phoneValue as string) : undefined;

    // Validate input
    const parsed = UpdateProfileSchema.safeParse({ userId, name, phone });
    if (!parsed.success) {
      return { error: "Invalid input data" };
    }

    const supabase = await createClient();

    // Check if phone is already taken
    if (phone) {
      const { data: existingPhone } = await supabase
        .from("users")
        .select("id")
        .eq("phone", phone)
        .neq("id", userId)
        .maybeSingle();

      if (existingPhone) {
        return { error: "This phone number is already in use" };
      }
    }

    // Build update object
    const updateData: Record<string, any> = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;

    if (Object.keys(updateData).length === 0) {
      return { error: "No fields to update" };
    }

    // Update database
    const { error: updateError } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", userId);

    if (updateError) {
      return { error: updateError.message };
    }

    // Fetch updated user data
    const { data: updatedUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError || !updatedUser) {
      return { error: "Profile updated but failed to fetch new data" };
    }

    revalidatePath("/profile", "layout");
    return {
      success: true,
      data: {
        user_id: userId,
        is_new_user: false,
        user: updatedUser, // Return full updated object
      },
    };
  } catch (error) {
    console.error("Update profile error:", error);
    return { error: "An unexpected error occurred" };
  }
}
```

### Client Component (screens/ProfileScreen.tsx)

```typescript
"use client";

import { useState, useEffect } from "react";
import { useActionState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { updateUserProfile } from "@/app/actions/auth";

export default function ProfileScreen() {
  const { user, setUser } = useAuthStore();
  const userDatabaseId = user?.user_id ?? "";

  // Edit state
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || "");
  const [nameError, setNameError] = useState("");

  // Server action state
  const [state, formAction, isPending] = useActionState(
    updateUserProfile,
    undefined,
  );

  // Sync input with user data when user updates
  useEffect(() => {
    setNameInput(user?.name || "");
  }, [user?.name]);

  // Handle server action response
  useEffect(() => {
    if (state?.success) {
      setIsEditingName(false);
      setNameError("");

      // Update store with returned data
      if (state.data?.user) {
        const userData = state.data.user;
        setUser({
          user_id: userData.id,
          phone: userData.phone,
          name: userData.name,
          userId: userData.display_id,
          elo: userData.elo,
          level: userData.level,
          xp: userData.total_xp,
          currentXp: userData.current_xp,
          xpToNextLevel: userData.xp_to_next_level,
          streak: userData.streak,
          tier: userData.tier,
          tierBadge: userData.tier_badge,
          subscription_tier: userData.subscription_tier,
          language_pref: userData.language_pref,
          admin_flag: userData.admin_flag,
        });
      }
    } else if (state?.error) {
      setNameError(state.error);
    }
  }, [state, setUser]);

  return (
    <div className="space-y-4">
      {/* Name Edit Section */}
      <div className="bg-navy-surface rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-black text-white">Full Name</p>
          {!isEditingName && (
            <button
              onClick={() => {
                setIsEditingName(true);
                setNameInput(user?.name || "");
                setNameError("");
              }}
              className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"
            >
              Edit
            </button>
          )}
        </div>

        {isEditingName ? (
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
              placeholder="Enter your full name"
              disabled={isPending}
              className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white"
            />

            {nameError && (
              <p className="text-xs text-red-400">{nameError}</p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl bg-green-500/20 text-green-400"
              >
                {isPending ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditingName(false);
                  setNameError("");
                  setNameInput(user?.name || ""); // Reset to saved value
                }}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm font-bold text-white">
            {user?.name || "No name added"}
          </p>
        )}
      </div>
    </div>
  );
}
```

## Benefits of This Pattern

✅ **Single API Call**: No double fetching - server action returns updated data
✅ **Optimized Re-renders**: Minimal useEffect dependencies prevent unnecessary updates
✅ **Consistent State**: Input fields always sync with store data
✅ **Better UX**: Instant feedback, proper loading states, error handling
✅ **Type Safety**: Full TypeScript support with proper types
✅ **Maintainability**: Clear separation of concerns between server and client
✅ **Performance**: Reduced network requests and re-renders

## Common Pitfalls to Avoid

### ❌ Pitfall 1: Refetching After Server Action

```typescript
// DON'T DO THIS
useEffect(() => {
  if (state?.success) {
    // Refetch data from database
    const data = await supabase.from("users").select("*");
    // This is a 2nd API call!
  }
}, [state]);
```

### ❌ Pitfall 2: Too Many useEffect Dependencies

```typescript
// DON'T DO THIS
useEffect(() => {
  // logic
}, [state, isEditing, isPending, user, setUser, formAction, ...]);
// Too many dependencies cause unnecessary re-renders
```

### ❌ Pitfall 3: Not Resetting Form State

```typescript
// DON'T DO THIS
<button onClick={() => setIsEditing(false)}>
  Cancel
</button>
// Input still has edited value, confusing for next edit
```

### ❌ Pitfall 4: Calling formAction Manually

```typescript
// DON'T DO THIS
const handleSubmit = (formData) => {
  formAction(formData); // Manual call
};

<form action={handleSubmit}>
  {/* This causes issues with useActionState */}
</form>
```

## Related Skills

- `#server-actions` - Server action fundamentals
- `#supabase-nextjs` - Supabase integration patterns
- `#next-best-practices` - General Next.js best practices
- `#react-19` - React 19 hooks and patterns

## References

- [Next.js Server Actions Documentation](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions)
- [useActionState Hook](https://react.dev/reference/react/useActionState)
- [useEffect Best Practices](https://react.dev/reference/react/useEffect)
- [Zustand State Management](https://github.com/pmndrs/zustand)
