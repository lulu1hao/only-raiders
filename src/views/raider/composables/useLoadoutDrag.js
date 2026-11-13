import { ref } from 'vue'

/**
 * Shared reactive drag state across RaiderLoadoutView and LoadoutPickerSidebar
 * Enables real-time compatibility preview during @dragover (where HTML5 dataTransfer.getData is restricted).
 *
 * Payload shapes:
 * - { kind: 'slot-weapon', weaponIndex: 0 | 1 }
 * - { kind: 'slot-mod', weaponIndex: 0 | 1, modSlotKey: string, modId: string }
 * - { kind: 'slot-item', container: 'backpack' | 'quickUse' | 'aux' | 'safePocket', index: number, itemId: string }
 * - { kind: 'picker-augment', augmentId: string }
 * - { kind: 'picker-shield', shieldId: string }
 * - { kind: 'picker-weapon', weaponId: string }
 * - { kind: 'picker-mod', modId: string, modSlotKey: string }
 * - { kind: 'picker-item', itemId: string }
 */
export const activeLoadoutDrag = ref(null)

export function startLoadoutDrag(event, payload) {
  activeLoadoutDrag.value = payload
  if (event?.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copyMove'
    try {
      event.dataTransfer.setData('text/plain', JSON.stringify(payload))
    } catch {
      // ignore sandbox dataTransfer restrictions
    }
  }
}

export function readLoadoutDrag(event) {
  if (activeLoadoutDrag.value) return activeLoadoutDrag.value
  try {
    const raw = event?.dataTransfer?.getData('text/plain')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearLoadoutDrag() {
  activeLoadoutDrag.value = null
}
