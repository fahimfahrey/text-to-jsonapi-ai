# Common Pitfalls & Solutions

## Pitfall 1: Double API Calls

### Problem

```typescript
// Server action updates DB
export async function updateUser(formData) {
  await supabase.from("users").update(data).eq("id", userId);
  return { success: true };
}

// Client refetches (2nd call!)
useEffect(() => {
  if (state?.success) {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();
    setUser(data);
  }
}, [state]);
```

**Symptoms:**

- Network tab shows 2 requests for 1 update
- Slow UI updates
- Wasted bandwidth

### Solution

```typescript
// Server action returns updated data
export async function updateUser(formData) {
  await supabase.from("users").update(data).eq("id", userId);

  // Fetch updated data
  const { data: updatedUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  return { success: true, data: updatedUser };
}

// Client uses returned data
useEffect(() => {
  if (state?.success && state.data) {
    setUser(state.data);
  }
}, [state, setUser]);
```

---

## Pitfall 2: Stale Form Inputs

### Problem

```typescript
// Input initialized once, never updates
const [nameInput, setNameInput] = useState(user?.name || "");

// After update, clicking edit shows old value
// User can't edit again without page refresh
```

**Symptoms:**

- Edit button doesn't work after first update
- Input shows stale data
- User confused about what's saved

### Solution

```typescript
// Sync input with store data
const [nameInput, setNameInput] = useState(user?.name || "");

useEffect(() => {
  setNameInput(user?.name || "");
}, [user?.name]);

// Cancel button resets to current value
<button
  onClick={() => {
    setIsEditing(false);
    setNameInput(user?.name || ""); // Reset
  }}
>
  Cancel
</button>
```

---

## Pitfall 3: Too Many useEffect Dependencies

### Problem

```typescript
// ❌ Effect runs constantly
useEffect(() => {
  if (state?.success) {
    setIsEditing(false);
  }
}, [state, isEditing, isPending, user, setUser, formAction, userDatabaseId]);
// Every time ANY of these change, effect runs!
```

**Symptoms:**

- Infinite loops
- Unnecessary re-renders
- Performance degradation
- Confusing behavior

### Solution

```typescript
// ✅ Only essential dependencies
useEffect(() => {
  if (state?.success) {
    setIsEditing(false);
  }
}, [state]);
// Only runs when state changes
```

---

## Pitfall 4: Not Resetting Form State

### Problem

```typescript
// Cancel doesn't reset input
<button
  onClick={() => {
    setIsEditing(false);
    setError("");
    // nameInput still has edited value!
  }}
>
  Cancel
</button>
```

**Symptoms:**

- User's edits persist after cancel
- Confusing UX
- Can't edit again properly

### Solution

```typescript
// Reset input on cancel
<button
  onClick={() => {
    setIsEditing(false);
    setError("");
    setNameInput(user?.name || ""); // Reset to saved
  }}
>
  Cancel
</button>
```

---

## Pitfall 5: Clearing Errors Too Late

### Problem

```typescript
// Error persists while user types
<input
  onChange={(e) => {
    setNameInput(e.target.value);
    // Error not cleared!
  }}
/>
```

**Symptoms:**

- Error message stays visible while user fixes it
- Confusing feedback
- Poor UX

### Solution

```typescript
// Clear error immediately on change
<input
  onChange={(e) => {
    setNameInput(e.target.value);
    setError(""); // Clear error
  }}
/>
```

---

## Pitfall 6: Not Handling Loading State

### Problem

```typescript
// No loading state
<button type="submit">Save</button>

// User can click multiple times
// Form can be submitted twice
```

**Symptoms:**

- Multiple submissions
- Duplicate data
- Race conditions
- Confusing UX

### Solution

```typescript
// Disable during submission
<button type="submit" disabled={isPending}>
  {isPending ? "Saving..." : "Save"}
</button>

// Disable inputs during submission
<input disabled={isPending} />
```

---

## Pitfall 7: Not Validating Before Submit

### Problem

```typescript
// No validation
<form action={formAction}>
  <input type="text" name="name" />
  <button type="submit">Save</button>
</form>

// Invalid data sent to server
// Server rejects it
// User confused
```

**Symptoms:**

- Invalid data in database
- Server errors
- Poor UX

### Solution

```typescript
// Validate before submit
<form
  action={formAction}
  onSubmit={(e) => {
    if (nameInput.trim().length < 2) {
      e.preventDefault();
      setError("Name must be at least 2 characters");
      return;
    }
    setError("");
  }}
>
  <input type="text" name="name" value={nameInput} />
  <button type="submit">Save</button>
</form>
```

---

## Pitfall 8: Mixing Manual Calls with useActionState

### Problem

```typescript
// ❌ Calling formAction manually
const handleSubmit = (formData) => {
  formAction(formData); // Manual call
};

<form action={handleSubmit}>
  {/* This breaks useActionState */}
</form>
```

**Symptoms:**

- useActionState doesn't work properly
- State not updating
- Confusing behavior

### Solution

```typescript
// ✅ Let form submission handle it
<form action={formAction}>
  <input type="text" name="name" />
  <button type="submit">Save</button>
</form>
// useActionState handles everything
```

---

## Pitfall 9: Not Handling Errors from Server

### Problem

```typescript
// No error handling
export async function updateUser(formData) {
  const { error } = await supabase.from("users").update(data).eq("id", userId);

  // Error ignored!
  return { success: true };
}
```

**Symptoms:**

- Silent failures
- User doesn't know what went wrong
- Data not actually updated

### Solution

```typescript
// Handle errors properly
export async function updateUser(formData) {
  const { error } = await supabase.from("users").update(data).eq("id", userId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// Show error to user
useEffect(() => {
  if (state?.error) {
    setError(state.error);
  }
}, [state?.error]);
```

---

## Pitfall 10: Not Revalidating Cache

### Problem

```typescript
// Server action doesn't revalidate
export async function updateUser(formData) {
  await supabase.from("users").update(data).eq("id", userId);

  // Cache not invalidated!
  return { success: true };
}
```

**Symptoms:**

- Stale data shown to other users
- Cache inconsistency
- Data not updated everywhere

### Solution

```typescript
// Revalidate cache
import { revalidatePath } from "next/cache";

export async function updateUser(formData) {
  await supabase.from("users").update(data).eq("id", userId);

  // Revalidate affected paths
  revalidatePath("/profile", "layout");
  revalidatePath("/dashboard", "layout");

  return { success: true };
}
```

---

## Pitfall 11: Depending on Entire Objects

### Problem

```typescript
// ❌ Depends on entire user object
useEffect(() => {
  setNameInput(user.name);
}, [user]);
// Runs every time ANY user property changes!
```

**Symptoms:**

- Unnecessary re-renders
- Input resets unexpectedly
- Performance issues

### Solution

```typescript
// ✅ Depend on specific property
useEffect(() => {
  setNameInput(user?.name || "");
}, [user?.name]);
// Only runs when name changes
```

---

## Pitfall 12: Not Preserving Edits on Error

### Problem

```typescript
// Reset input on error
useEffect(() => {
  if (state?.error) {
    setError(state.error);
    setNameInput(""); // Clears user's edits!
  }
}, [state?.error]);
```

**Symptoms:**

- User loses their edits on error
- Have to retype everything
- Frustrating UX

### Solution

```typescript
// Keep input on error
useEffect(() => {
  if (state?.error) {
    setError(state.error);
    // Don't reset input - user can fix and retry
  }
}, [state?.error]);
```

---

## Quick Checklist

When building forms with server actions:

- [ ] Server action returns updated data
- [ ] Client uses returned data (no refetch)
- [ ] Input state syncs with store data
- [ ] Cancel button resets input
- [ ] Errors clear on input change
- [ ] Loading state disables inputs
- [ ] Validation runs before submit
- [ ] useEffect dependencies are minimal
- [ ] Errors are handled and shown
- [ ] Cache is revalidated
- [ ] Multiple edits work correctly
- [ ] Edits preserved on error

---

## Testing Checklist

Test these scenarios:

1. **First Update**
   - [ ] Click edit
   - [ ] Change value
   - [ ] Click save
   - [ ] Data updates
   - [ ] Edit mode closes

2. **Second Update**
   - [ ] Click edit again
   - [ ] Input shows current value (not old)
   - [ ] Change value
   - [ ] Click save
   - [ ] Data updates

3. **Cancel**
   - [ ] Click edit
   - [ ] Change value
   - [ ] Click cancel
   - [ ] Input resets to saved value
   - [ ] Edit mode closes

4. **Error Handling**
   - [ ] Submit invalid data
   - [ ] Error shows
   - [ ] Input preserved
   - [ ] Can fix and retry

5. **Network**
   - [ ] Only 1 API call per update
   - [ ] No double fetches
   - [ ] Cache properly invalidated

---

## Performance Metrics

| Issue                    | Impact                 | Fix                     |
| ------------------------ | ---------------------- | ----------------------- |
| Double API calls         | 2x latency             | Return data from server |
| Stale inputs             | Can't edit             | Sync with useEffect     |
| Too many dependencies    | Constant re-renders    | Minimize dependencies   |
| No loading state         | Multiple submissions   | Disable during submit   |
| No validation            | Invalid data           | Validate before submit  |
| No error handling        | Silent failures        | Handle and show errors  |
| Entire object dependency | Unnecessary re-renders | Depend on properties    |
| Not revalidating         | Stale cache            | Use revalidatePath      |

---

## Key Takeaways

1. **Return data from server actions** - Avoid client refetch
2. **Sync inputs with store** - Use useEffect
3. **Minimize dependencies** - Only what's needed
4. **Reset on cancel** - Discard edits
5. **Clear errors on change** - Give feedback
6. **Disable during submit** - Prevent double submission
7. **Validate before submit** - Prevent invalid data
8. **Handle errors** - Show to user
9. **Revalidate cache** - Keep data fresh
10. **Test multiple edits** - Ensure state resets properly
