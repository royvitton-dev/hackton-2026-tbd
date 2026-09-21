import sources from './vehicleImageSources.json';
import models from './vehicleModelSources.json';
import type { VehicleImage } from '../types/vehicle';
// Each model's provenance and license status is recorded in vehicleModelSources.json.
export const vehicleGlbPaths: Record<string, string> = {
  hyundai_ioniq5_lr_2wd_2026:'/assets/vehicles/models/hyundai_ioniq5.glb',
  hyundai_ioniq5_standard_2wd_2026:'/assets/vehicles/models/hyundai_ioniq5.glb',
  hyundai_kona_ev_lr_2026:'/assets/vehicles/models/hyundai_kona_electric_2019.glb',
  kia_ev3_standard_2026:'/assets/vehicles/models/kia_ev3.glb',
  kia_ev3_lr_2wd_2026:'/assets/vehicles/models/kia_ev3.glb',
  kia_ev6_lr_2wd_2026:'/assets/vehicles/models/kia_ev6.glb',
  kia_ev9_lr_2wd_2026:'/assets/vehicles/models/kia_ev9.glb',
  kia_niro_ev_2026:'/assets/vehicles/models/kia_niro_ev.glb',
  tesla_model3_standard_rwd_2026:'/assets/vehicles/models/tesla_model_3.glb',
  tesla_model3_lr_rwd_2026:'/assets/vehicles/models/tesla_model_3.glb',
  tesla_modely_premium_rwd_2026:'/assets/vehicles/models/tesla_model_y_optimized.glb',
  tesla_modely_lr_awd_2026:'/assets/vehicles/models/tesla_model_y_optimized.glb',
};
export const vehicleImageMap: VehicleImage[] = sources.map(source => ({
  vehicleId:source.vehicleId,manufacturer:source.manufacturer,model:source.model,year:source.year,
  imagePath:source.publicOriginalPath,cutoutImagePath:source.publicCutoutPath,
  resourceOriginalPath:source.resourceOriginalPath,resourceCutoutPath:source.resourceCutoutPath,
  imageSourceUrl:source.sourceUrl,license:source.license,licenseUrl:source.licenseUrl,author:source.author,
  representativeNote:source.representativeNote,glbPath:vehicleGlbPaths[source.vehicleId]??null,
  modelDisplayNote:models.find(m=>m.vehicleId===source.vehicleId)?.displayNote??null,
  renderMode:vehicleGlbPaths[source.vehicleId]?'glb':'unavailable',
  // Retained source metadata; photo depth stacks are explicitly disabled by the revised requirement.
  depthLayerCount:0,extrusionDepth:0,
  downloaded:source.downloaded,cutoutGenerated:source.cutoutGenerated,failureReason:source.failureReason,
  batteryHotspot:{x:.52,y:.68,width:.22,height:.1},
}));
