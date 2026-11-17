<script setup>
import { inject } from 'vue'
import { useRouter } from 'vue-router'
import { useWeaponsStore } from '../../stores/useWeaponsStore'
import LoadoutCard from './components/LoadoutCard.vue'
import GunAttributesCard from './components/GunAttributesCard.vue'
import TtkMatrixCard from './components/TtkMatrixCard.vue'

const router = useRouter()
const store = useWeaponsStore()
const overlay = inject('weaponsOverlay')
const tone = inject('weaponsTone', (c) => c)

function handleSendToCompare(targetIdx = null) {
  store.sendCurrentBuildToCompare(targetIdx)
  router.push('/weapons/compare')
}
</script>

<template>
  <main
    v-if="store.selectedEnriched && store.currentCalc"
    class="bench"
    @scroll.passive="overlay.closeMenu"
  >
    <!-- Top Grid: Loadout | Real-time Gun Attributes -->
    <div class="bench-grid">
      <div class="col-config">
        <header class="ar-head w-head">
          <h2>改装</h2>
          <div class="compare-send">
            <button
              class="ar-btn ar-btn--sm"
              :title="`将当前配装加入对比栏 #${store.nextCompareTargetIdx + 1}`"
              @click="handleSendToCompare()"
            >
              加入对比
            </button>
            <div class="csg-slots" title="指定加入哪个对比栏">
              <button
                v-for="n in 3"
                :key="n"
                class="csg-slot-btn"
                :class="{
                  next: store.nextCompareTargetIdx === n - 1,
                  filled: store.compareSlots[n - 1]?.userFilled,
                }"
                :title="
                  n <= store.compareSlots.length
                    ? `放入对比栏 #${n}（当前：${store.getWeaponById(store.compareSlots[n - 1].weaponId)?.zhName}）`
                    : '新增并放入对比栏 #3'
                "
                @click="handleSendToCompare(n - 1)"
              >
                {{ n }}
              </button>
            </div>
          </div>
        </header>

        <section
          class="ar-panel loadout"
          :style="{ '--r': tone(store.activeAmpIds.length ? '#ffc600' : store.selectedEnriched.rarityColor) }"
        >
          <LoadoutCard
            :weapon="store.selectedEnriched"
            :calc="store.currentCalc"
            :amp-ids="store.activeAmpIds"
            :mods="store.selectedMods"
            :compare-idx="-1"
            @clear-mods="store.clearWorkbenchMods"
          />
        </section>
      </div>

      <GunAttributesCard
        :weapon="store.selectedEnriched"
        :calc="store.currentCalc"
        :amp-ids="store.activeAmpIds"
        :stat-rows="store.statRows"
        :handling-items="store.handlingItems"
      />
    </div>

    <!-- Bottom: Full-Width TTK Module -->
    <TtkMatrixCard :calc="store.currentCalc" />
  </main>
</template>
