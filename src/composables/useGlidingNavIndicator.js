import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, unref, watch } from 'vue'
import gsap from 'gsap'

/**
 * Shared ARC Raiders tactical gliding active rail + rounded hover pill controller
 * for horizontal navigation bars.
 */
export function useGlidingNavIndicator(options) {
  const {
    activeId,
    items,
    insetLeft = 16,
    insetRight = 16,
    firstTabInsetLeft = null,
    pillInset = 6,
    defaultRgb = [255, 188, 19],
  } = options

  const navRef = ref(null)
  const tabEls = new Map()
  const hoveredId = ref(null)

  const rail = reactive({
    left: 0,
    right: 0,
    pillX: 0,
    pillW: 0,
    r: defaultRgb[0],
    g: defaultRgb[1],
    b: defaultRgb[2],
    opacity: 0,
    ready: false,
  })

  const hoverPill = reactive({
    x: 0,
    width: 0,
    opacity: 0,
    visible: false,
  })

  let resizeObserver = null

  function isReducedMotion() {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  }

  function getItemList() {
    const list = unref(items)
    return Array.isArray(list) ? list : []
  }

  function getItemIndex(id) {
    return getItemList().findIndex((item) => item.id === id)
  }

  function getItemRgb(id) {
    const item = getItemList().find((entry) => entry.id === id)
    return Array.isArray(item?.rgb) && item.rgb.length === 3 ? item.rgb : defaultRgb
  }

  function measureTab(id) {
    const el = tabEls.get(id)
    if (!el || el.offsetWidth <= 0) return null

    const idx = getItemIndex(id)
    const padL = idx === 0 && firstTabInsetLeft !== null ? firstTabInsetLeft : insetLeft
    const padR = insetRight
    const left = el.offsetLeft + padL
    const right = Math.max(left + 8, el.offsetLeft + el.offsetWidth - padR)

    const pillPadL =
      idx === 0 && firstTabInsetLeft !== null ? Math.max(0, firstTabInsetLeft - 2) : pillInset
    const pillX = el.offsetLeft + pillPadL
    const pillW = Math.max(12, el.offsetWidth - (pillPadL + pillInset))

    return { left, right, pillX, pillW }
  }

  function syncHoverPill(immediate = false) {
    const id = hoveredId.value
    const currentActiveId = unref(activeId)
    const m = id && id !== currentActiveId ? measureTab(id) : null
    if (!m) {
      hoverPill.visible = false
      gsap.killTweensOf(hoverPill)
      if (immediate || isReducedMotion()) {
        hoverPill.opacity = 0
      } else {
        gsap.to(hoverPill, {
          opacity: 0,
          duration: 0.16,
          ease: 'power2.out',
        })
      }
      return
    }

    const wasInvisible = !hoverPill.visible && hoverPill.opacity < 0.05
    hoverPill.visible = true
    gsap.killTweensOf(hoverPill)

    if (immediate || isReducedMotion()) {
      hoverPill.x = m.pillX
      hoverPill.width = m.pillW
      hoverPill.opacity = 1
      return
    }

    if (wasInvisible) {
      hoverPill.x = m.pillX
      hoverPill.width = m.pillW
      gsap.to(hoverPill, {
        opacity: 1,
        duration: 0.16,
        ease: 'power2.out',
      })
      return
    }

    gsap.to(hoverPill, {
      x: m.pillX,
      width: m.pillW,
      opacity: 1,
      duration: 0.26,
      ease: 'expo.out',
    })
  }

  function syncActiveRail(immediate = false) {
    const id = unref(activeId)
    const m = measureTab(id)
    if (!m) {
      rail.opacity = 0
      return
    }

    const [tr, tg, tb] = getItemRgb(id)

    if (immediate || !rail.ready || isReducedMotion()) {
      gsap.killTweensOf(rail)
      rail.left = m.left
      rail.right = m.right
      rail.pillX = m.pillX
      rail.pillW = m.pillW
      rail.r = tr
      rail.g = tg
      rail.b = tb
      rail.opacity = 1
      rail.ready = true
      return
    }

    gsap.killTweensOf(rail)
    rail.opacity = 1

    // Leading edge advances first (expo.out) while trailing edge follows smoothly
    // (power3.out) to produce an organic stretch-and-settle travel along the rail.
    const goingRight = m.left >= rail.left
    if (goingRight) {
      gsap.to(rail, { right: m.right, duration: 0.28, ease: 'expo.out' })
      gsap.to(rail, { left: m.left, duration: 0.44, ease: 'power3.out' })
    } else {
      gsap.to(rail, { left: m.left, duration: 0.28, ease: 'expo.out' })
      gsap.to(rail, { right: m.right, duration: 0.44, ease: 'power3.out' })
    }

    gsap.to(rail, {
      pillX: m.pillX,
      pillW: m.pillW,
      duration: 0.32,
      ease: 'expo.out',
    })

    gsap.to(rail, {
      r: tr,
      g: tg,
      b: tb,
      duration: 0.34,
      ease: 'power2.out',
    })
  }

  function setTabRef(id, el) {
    const domEl = el?.$el || el
    const prev = tabEls.get(id)
    if (prev && prev !== domEl && resizeObserver) {
      resizeObserver.unobserve(prev)
    }

    if (domEl && typeof domEl.offsetLeft === 'number') {
      tabEls.set(id, domEl)
      if (resizeObserver && prev !== domEl) {
        resizeObserver.observe(domEl)
      }
    } else {
      tabEls.delete(id)
    }
  }

  function onTabPointerEnter(id) {
    hoveredId.value = id
    syncHoverPill(false)
  }

  function onNavPointerLeave() {
    hoveredId.value = null
    syncHoverPill(false)
  }

  const accentRgbCss = computed(
    () => `${Math.round(rail.r)}, ${Math.round(rail.g)}, ${Math.round(rail.b)}`,
  )

  const railStyle = computed(() => {
    const x = Math.min(rail.left, rail.right)
    const w = Math.max(8, Math.abs(rail.right - rail.left))
    return {
      transform: `translate3d(${x.toFixed(2)}px, 0, 0)`,
      width: `${w.toFixed(2)}px`,
      opacity: rail.opacity,
      '--nav-accent-rgb': accentRgbCss.value,
    }
  })

  const glowStyle = computed(() => ({
    transform: `translate3d(${rail.pillX.toFixed(2)}px, 0, 0)`,
    width: `${Math.max(12, rail.pillW).toFixed(2)}px`,
    opacity: rail.opacity,
    '--nav-accent-rgb': accentRgbCss.value,
  }))

  const hoverPillStyle = computed(() => ({
    transform: `translate3d(${hoverPill.x.toFixed(2)}px, 0, 0)`,
    width: `${hoverPill.width.toFixed(2)}px`,
    opacity: hoverPill.opacity,
  }))

  watch(
    () => unref(activeId),
    () => {
      nextTick(() => {
        syncActiveRail(false)
        syncHoverPill(false)
      })
    },
  )

  onMounted(() => {
    nextTick(() => {
      syncActiveRail(true)
    })

    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(() => {
        syncHoverPill(true)
        if (!gsap.isTweening(rail)) {
          syncActiveRail(true)
        }
      })
      if (navRef.value) {
        resizeObserver.observe(navRef.value)
      }
      for (const el of tabEls.values()) {
        resizeObserver.observe(el)
      }
    }

    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!gsap.isTweening(rail)) {
          syncActiveRail(true)
        }
      })
    }
  })

  onBeforeUnmount(() => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    gsap.killTweensOf(rail)
    gsap.killTweensOf(hoverPill)
  })

  return {
    navRef,
    setTabRef,
    onTabPointerEnter,
    onNavPointerLeave,
    railStyle,
    glowStyle,
    hoverPillStyle,
    syncActiveRail,
  }
}
