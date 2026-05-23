# API Call Patterns & Optimization

## Problem: Double API Calls

When updating data in a Next.js app with server actions, it's common to accidentally make two API calls:

1. **First call**: Server action updates the database
2. **Second call**: Client-side `useEffect` refetches the data

This wastes bandwidth and creates unnecessary latency.

## Solution: Return Data from Server Action

### Pattern 1: Simple Update with Return

```typescript
// ✅ GOOD: Server action returns updated data
export async function updateUserName(
  _prevState: any,
  formData: FormData,
): Promise<{ success: boolean; data?: any; error?: string }> {
  const userId = formData.get("userId");
  const name = formData.get("name");

  const supabase = await createClient();

  // Update database
  const { error } = await supabase
    .from("users")
    .update({ name })
    .eq("id", userId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Fetch updated data
  const { data: updatedUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  // Return the updated data
  return {
    success: true,
    data: updatedUser,
  };
}
```

### Pattern 2: Batch Update with Multiple Fields

```typescript
export async function updateUserProfile(
  _prevState: any,
  formData: FormData,
): Promise<{ success: boolean; data?: any; error?: string }> {
  const userId = formData.get("userId");
  const name = formData.get("name");
  const phone = formData.get("phone");
  const email = formData.get("email");

  const supabase = await createClient();

  // Build update object with only provided fields
  const updateData: Record<string, any> = {};
  if (name) updateData.name = name;
  if (phone) updateData.phone = phone;
  if (email) updateData.email = email;

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: "No fields to update" };
  }

  // Single update call
  const { error } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", userId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Fetch complete updated record
  const { data: updatedUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  return {
    success: true,
    data: updatedUser,
  };
}
```

### Pattern 3: Update with Validation

```typescript
export async function updateUserEmail(
  _prevState: any,
  formData: FormData,
): Promise<{ success: boolean; data?: any; error?: string }> {
  const userId = formData.get("userId");
  const email = formData.get("email");

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: "Invalid email format" };
  }

  const supabase = await createClient();

  // Check if email already exists
  const { data: existingEmail } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .neq("id", userId)
    .maybeSingle();

  if (existingEmail) {
    return { success: false, error: "Email already in use" };
  }

  // Update
  const { error } = await supabase
    .from("users")
    .update({ email })
    .eq("id", userId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Fetch and return updated data
  const { data: updatedUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  return {
    success: true,
    data: updatedUser,
  };
}
```

## Client-Side: Using Returned Data

### Pattern 1: Update Zustand Store

```typescript
"use client";

import { useActionState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { updateUserProfile } from "@/app/actions/auth";

export default function ProfileForm() {
  const { user, setUser } = useAuthStore();
  const [state, formAction, isPending] = useActionState(
    updateUserProfile,
    undefined,
  );

  useEffect(() => {
    if (state?.success && state.data) {
      // Update store with returned data
      setUser({
        user_id: state.data.id,
        name: state.data.name,
        phone: state.data.phone,
        email: state.data.email,
        // ... other fields
      });

      // Close edit mode
      setIsEditing(false);
    } else if (state?.error) {
      setError(state.error);
    }
  }, [state, setUser]);

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={user?.user_id} />
      <input type="text" name="name" placeholder="Name" />
      <button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
```

### Pattern 2: Update Multiple Stores

```typescript
useEffect(() => {
  if (state?.success && state.data) {
    // Update auth store
    setUser({
      user_id: state.data.id,
      name: state.data.name,
      // ...
    });

    // Update subscription store if needed
    if (state.data.subscription_tier) {
      setSubscriptionTier(state.data.subscription_tier);
    }

    // Update profile store if needed
    setProfile({
      bio: state.data.bio,
      avatar: state.data.avatar,
      // ...
    });

    // Show success message
    showToast("Profile updated successfully");
  }
}, [state, setUser, setSubscriptionTier, setProfile]);
```

### Pattern 3: Partial Updates

```typescript
useEffect(() => {
  if (state?.success && state.data) {
    // Only update changed fields
    setUser((prev) => ({
      ...prev,
      name: state.data.name || prev.name,
      phone: state.data.phone || prev.phone,
    }));
  }
}, [state, setUser]);
```

## Comparison: Before vs After

### ❌ BEFORE: Double API Call

```typescript
// Server action
export async function updateUserProfile(formData) {
  // 1st API call: Update database
  await supabase.from("users").update(data).eq("id", userId);

  return { success: true };
}

// Client component
useEffect(() => {
  if (state?.success) {
    // 2nd API call: Refetch data
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    setUser(data);
  }
}, [state]);
```

**Result**: 2 API calls, slower UX, wasted bandwidth

### ✅ AFTER: Single API Call

```typescript
// Server action
export async function updateUserProfile(formData) {
  // Update database
  await supabase.from("users").update(data).eq("id", userId);

  // Fetch updated data
  const { data: updatedUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  // Return updated data
  return { success: true, data: updatedUser };
}

// Client component
useEffect(() => {
  if (state?.success && state.data) {
    // Use returned data directly
    setUser(state.data);
  }
}, [state, setUser]);
```

**Result**: 1 API call, faster UX, optimized bandwidth

## Performance Metrics

| Metric            | Before | After  | Improvement   |
| ----------------- | ------ | ------ | ------------- |
| API Calls         | 2      | 1      | 50% reduction |
| Network Latency   | ~400ms | ~200ms | 50% faster    |
| Time to Update UI | ~400ms | ~200ms | 50% faster    |
| Bandwidth Used    | 2x     | 1x     | 50% savings   |

## Key Takeaways

1. **Always return data from server actions** - Don't make the client refetch
2. **Fetch once, return once** - Get the updated data in the server action
3. **Use the returned data** - Update your store/state with it
4. **Avoid client-side refetches** - They're unnecessary and wasteful
5. **Type your responses** - Use TypeScript for safety
