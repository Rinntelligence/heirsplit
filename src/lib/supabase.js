import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const signUp = (email, password) =>
  supabase.auth.signUp({ email, password })

export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password })

export const signOut = () => supabase.auth.signOut()

// ── Profiles ──────────────────────────────────────────────────────────────────
export const getProfile = (user_id) =>
  supabase.from('profiles').select('*').eq('user_id', user_id).single()

export const upsertProfile = (data) =>
  supabase.from('profiles').upsert(data, { onConflict: 'user_id' }).select().single()

// ── Estates ───────────────────────────────────────────────────────────────────
export const getMyEstates = (user_id) =>
  supabase.from('estate_members')
    .select('estate_id, role, estates(id, name, description, created_at, owner_id, branding_color, branding_logo, status)')
    .eq('user_id', user_id)

export const getEstate = (id) =>
  supabase.from('estates').select('*').eq('id', id).single()

export const createEstate = (data) =>
  supabase.from('estates').insert(data).select().single()

export const updateEstate = (id, data) =>
  supabase.from('estates').update(data).eq('id', id).select().single()

export const getEstateMembers = (estate_id) =>
  supabase.from('estate_members')
    .select('*, profiles(display_name, avatar_color, email)')
    .eq('estate_id', estate_id)

export const joinEstateByCode = async (invite_code, user_id) => {
  const { data: estate } = await supabase
    .from('estates').select('id').eq('invite_code', invite_code).single()
  if (!estate) return { error: { message: 'Invalid invite code' } }
  return supabase.from('estate_members')
    .insert({ estate_id: estate.id, user_id, role: 'member' })
    .select().single()
}

// ── Items ─────────────────────────────────────────────────────────────────────
export const getItems = (estate_id) =>
  supabase.from('items')
    .select('*, categories(label, emoji), interests(*, profiles(display_name, avatar_color)), comments(count), assigned_to_profile:profiles!items_assigned_to_fkey(display_name, avatar_color)')
    .eq('estate_id', estate_id)
    .order('created_at', { ascending: false })

export const getItem = (id) =>
  supabase.from('items')
    .select('*, categories(label, emoji), interests(*, profiles(display_name, avatar_color)), assigned_to_profile:profiles!items_assigned_to_fkey(display_name, avatar_color)')
    .eq('id', id).single()

export const createItem = (data) =>
  supabase.from('items').insert(data).select().single()

export const updateItem = (id, data) =>
  supabase.from('items').update(data).eq('id', id).select().single()

export const deleteItem = (id) =>
  supabase.from('items').delete().eq('id', id)

export const assignItem = (id, user_id) =>
  supabase.from('items').update({ assigned_to: user_id, status: 'assigned' }).eq('id', id)

// ── Interests ─────────────────────────────────────────────────────────────────
export const addInterest = (item_id, user_id, reason) =>
  supabase.from('interests').insert({ item_id, user_id, reason }).select().single()

export const removeInterest = (item_id, user_id) =>
  supabase.from('interests').delete().eq('item_id', item_id).eq('user_id', user_id)

// ── Comments ──────────────────────────────────────────────────────────────────
export const getComments = (item_id) =>
  supabase.from('comments')
    .select('*, profiles(display_name, avatar_color)')
    .eq('item_id', item_id)
    .order('created_at', { ascending: true })

export const addComment = (item_id, user_id, content) =>
  supabase.from('comments').insert({ item_id, user_id, content }).select('*, profiles(display_name, avatar_color)').single()

export const deleteComment = (id) =>
  supabase.from('comments').delete().eq('id', id)

// ── Categories ────────────────────────────────────────────────────────────────
export const getCategories = () =>
  supabase.from('categories').select('*').order('label')

export const createCategory = (data) =>
  supabase.from('categories').insert(data).select().single()

export const deleteCategory = (id) =>
  supabase.from('categories').delete().eq('id', id)

// ── Feedback ──────────────────────────────────────────────────────────────────
export const submitFeedback = (user_id, estate_id, type, content, nps_score) =>
  supabase.from('feedback').insert({ user_id, estate_id, type, content, nps_score })

export const getAllFeedback = () =>
  supabase.from('feedback').select('*, profiles(display_name, email)').order('created_at', { ascending: false })

// ── Image upload ──────────────────────────────────────────────────────────────
export const uploadImage = async (file, itemId) => {
  const ext = file.name.split('.').pop()
  const path = `items/${itemId}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('item-images').upload(path, file, { upsert: true })
  if (error) throw error
  return supabase.storage.from('item-images').getPublicUrl(path).data.publicUrl
}

export const uploadLogo = async (file, estateId) => {
  const ext = file.name.split('.').pop()
  const path = `logos/${estateId}.${ext}`
  const { error } = await supabase.storage.from('item-images').upload(path, file, { upsert: true })
  if (error) throw error
  return supabase.storage.from('item-images').getPublicUrl(path).data.publicUrl
}

// ── Founder / admin ───────────────────────────────────────────────────────────
export const getAllEstates = () =>
  supabase.from('estates').select('*, profiles!estates_owner_id_fkey(display_name, email)').order('created_at', { ascending: false })

export const getAllProfiles = () =>
  supabase.from('profiles').select('*').order('created_at', { ascending: false })
