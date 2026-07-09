<template>
  <div>
    <!-- 图层开关 + 图例 -->
    <el-card shadow="never" style="margin-bottom:10px;">
      <div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
        <span style="font-weight:600; margin-right:4px;">图层:</span>
        <el-check-tag v-model="layers.helps" @change="reloadLayer('helps')">求助点</el-check-tag>
        <el-check-tag v-model="layers.water" @change="reloadLayer('water')" type="danger">水位</el-check-tag>
        <el-check-tag v-model="layers.roads" @change="reloadLayer('roads')" type="warning">道路</el-check-tag>
        <el-check-tag v-model="layers.shelters" @change="reloadLayer('shelters')" type="success">避难所</el-check-tag>
      </div>
    </el-card>

    <el-card shadow="never" v-loading="loading">
      <LMap
        :zoom="zoom" :center="center" :min-zoom="4" :max-zoom="18"
        style="height:calc(100vh - 200px); width:100%; min-height:380px;"
      >
        <LTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" :max-zoom="19" />

        <!-- 求助点 -->
        <template v-if="layers.helps">
          <LMarker v-for="p in helpPoints" :key="'h'+p.code"
            :lat-lng="[p.location.coordinates[1], p.location.coordinates[0]]">
            <LIcon :icon-url="helpPin(p)" :icon-size="[22,22]" />
            <LPopup>
              <div style="min-width:150px;">
                <strong>{{ p.code }}</strong>
                <el-tag :type="urgencyType(p.urgency)" size="small" effect="dark" style="margin-left:4px;">{{ urgencyLabel(p.urgency) }}</el-tag>
                <div v-if="p.resolved" style="color:#07c160;font-size:12px;">✓ 已脱险</div>
                <div style="margin:4px 0;font-size:12px;">{{ p.content?.summary || p.content?.rawText }}</div>
                <div class="muted" style="font-size:11px;">{{ p.location?.address || p.location?.raw }}</div>
              </div>
            </LPopup>
          </LMarker>
        </template>

        <!-- 水位点(数字图钉) -->
        <template v-if="layers.water">
          <LMarker v-for="w in waterPoints" :key="'w'+w._id"
            :lat-lng="[w.coordinates[1], w.coordinates[0]]">
            <LIcon :icon-url="waterPin(w)" :icon-size="[22,22]" />
            <LPopup>
              <div style="min-width:160px;">
                <strong>{{ w.location }}</strong>
                <el-tag :type="waterType(w.level)" size="small" effect="dark" style="margin-left:4px;">{{ levelLabel(w.level) }}</el-tag>
                <el-tag v-if="w.trend==='rising'" type="danger" size="small" style="margin-left:2px;">↑涨</el-tag>
                <div style="margin:4px 0;font-size:12px;">{{ w.description }}</div>
                <div class="muted" style="font-size:11px;">{{ w.province }}{{ w.city }}{{ w.district }}</div>
              </div>
            </LPopup>
          </LMarker>
        </template>

        <!-- 道路(方块图标) -->
        <template v-if="layers.roads">
          <LMarker v-for="r in roadPoints" :key="'r'+r._id"
            :lat-lng="[r.coordinates[1], r.coordinates[0]]">
            <LIcon :icon-url="roadPin(r)" :icon-size="[20,20]" />
            <LPopup>
              <div style="min-width:150px;">
                <strong>{{ r.roadName }}</strong>
                <el-tag :type="roadType(r.status)" size="small" effect="dark" style="margin-left:4px;">{{ roadLabel(r.status) }}</el-tag>
                <div v-if="r.description" style="margin:4px 0;font-size:12px;">{{ r.description }}</div>
              </div>
            </LPopup>
          </LMarker>
        </template>

        <!-- 避难所(绿色房屋图标) -->
        <template v-if="layers.shelters">
          <LMarker v-for="s in shelterPoints" :key="'s'+s._id"
            :lat-lng="[s.coordinates[1], s.coordinates[0]]">
            <LIcon :icon-url="shelterPin(s)" :icon-size="[22,22]" />
            <LPopup>
              <div style="min-width:150px;">
                <strong>{{ s.name }}</strong>
                <div style="margin:4px 0;font-size:12px;">
                  容量:{{ s.inmates }}/{{ s.totalCapacity }}
                  <span :style="{color: s.available?'#07c160':'#f56c6c'}">({{ s.available?'可接收':'已满' }})</span>
                </div>
                <div class="muted" style="font-size:11px;">{{ s.location }}</div>
              </div>
            </LPopup>
          </LMarker>
        </template>
      </LMap>
    </el-card>

    <!-- 图例 -->
    <div style="margin-top:8px; font-size:12px; color:#909399;">
      图标: ●数字=水位(0无水→6淹一层) ●求助(红紧急) ■道路 ▣避难所(绿可接收/红已满)
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { LMap, LTileLayer, LMarker, LPopup, LIcon } from '@vue-leaflet/vue-leaflet';
import { listHelps, listShelters, getWaterMap, listRoads } from '../api/admin.js';

const loading = ref(false);
const zoom = ref(7);
const center = ref([23.5, 111.5]);

const layers = reactive({ helps: true, water: true, roads: true, shelters: true });
const helpPoints = ref([]);
const waterPoints = ref([]);
const roadPoints = ref([]);
const shelterPoints = ref([]);

// ===== 标签与颜色 =====
const LEVELS = { 0:'无积水',1:'及踝',2:'齐膝',3:'齐腰',4:'齐胸',5:'齐脖以上',6:'已淹一层' };
const levelLabel = (l) => LEVELS[l] ?? l;
const waterType = (l) => l>=5?'danger':l>=3?'warning':l>=1?'':'info';
const urgencyLabel = (u) => ({critical:'紧急',high:'紧迫',medium:'一般',low:'报备'}[u]||u);
const urgencyType = (u) => ({critical:'danger',high:'warning',medium:'',low:'info'}[u]||'');
const roadLabel = (s) => ({passable:'可通行',difficult:'难行',impassable:'阻断',unknown:'未知'}[s]||s);
const roadType = (s) => ({passable:'success',difficult:'warning',impassable:'danger',unknown:'info'}[s]||'info');

// ===== 图标生成(SVG,免外部图片)=====
function svgPin(content, color, shape='circle') {
  const inner = shape==='square'
    ? `<rect x="3" y="3" width="16" height="16" rx="3" fill="${color}" stroke="#fff" stroke-width="2"/>`
    : `<circle cx="11" cy="11" r="9" fill="${color}" stroke="#fff" stroke-width="2"/>`;
  const text = content ? `<text x="11" y="15" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">${content}</text>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22">${inner}${text}</svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}
const WATER_COLORS = {0:'#909399',1:'#e6a23c',2:'#e6a23c',3:'#ff976a',4:'#ee0a24',5:'#ee0a24',6:'#722233'};
const HELP_COLORS = {critical:'#ee0a24',high:'#ff976a',medium:'#1989fa',low:'#909399'};
const ROAD_COLORS = {passable:'#07c160',difficult:'#e6a23c',impassable:'#ee0a24',unknown:'#909399'};

function helpPin(p) { return svgPin('', p.resolved ? '#07c160' : (HELP_COLORS[p.urgency]||'#1989fa')); }
function waterPin(w) { return svgPin(String(w.level), WATER_COLORS[w.level]||'#909399'); }
function roadPin(r) { return svgPin('', ROAD_COLORS[r.status]||'#909399', 'square'); }
function shelterPin(s) { return svgPin('', s.available ? '#07c160' : '#f56c6c', 'square'); }

// ===== 按图层加载 =====
async function loadHelps() {
  if (!layers.helps) return;
  const res = await listHelps({ pageSize: 500 });
  helpPoints.value = (res.data.items||[]).filter(p => p.location?.coordinates?.length === 2);
}
async function loadWater() {
  if (!layers.water) return;
  const res = await getWaterMap({ hours: 48 });
  waterPoints.value = (res.data||[]).filter(w => w.coordinates?.length === 2);
}
async function loadRoads() {
  if (!layers.roads) return;
  const res = await listRoads();
  roadPoints.value = (res.data||[]).filter(r => r.coordinates?.length === 2);
}
async function loadShelters() {
  if (!layers.shelters) return;
  const res = await listShelters();
  shelterPoints.value = (res.data||[]).filter(s => s.coordinates?.length === 2);
}

async function reloadLayer(name) {
  loading.value = true;
  try {
    if (name==='helps') layers.helps ? await loadHelps() : (helpPoints.value=[]);
    if (name==='water') layers.water ? await loadWater() : (waterPoints.value=[]);
    if (name==='roads') layers.roads ? await loadRoads() : (roadPoints.value=[]);
    if (name==='shelters') layers.shelters ? await loadShelters() : (shelterPoints.value=[]);
  } finally { loading.value = false; }
}

onMounted(async () => {
  loading.value = true;
  try { await Promise.all([loadHelps(), loadWater(), loadRoads(), loadShelters()]); }
  finally { loading.value = false; }
});
</script>
