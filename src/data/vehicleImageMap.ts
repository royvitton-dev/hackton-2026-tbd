import sources from './vehicleImageSources.json';
import models from './vehicleModelSources.json';
import type { VehicleImage } from '../types/vehicle';
// Approximate pack callouts placed between the wheels in each source photograph.
const photoHotspots: Record<string, VehicleImage['batteryHotspot']> = {
  hyundai_ioniq6_lr_2wd_2026:{x:.69,y:.66,width:.20,height:.065},
  audi_q4_45_etron_2026:{x:.77,y:.66,width:.16,height:.045},
  audi_q6_etron_quattro_2025:{x:.73,y:.68,width:.19,height:.045},
  vw_id4_pro_2026:{x:.77,y:.65,width:.16,height:.045},
  bmw_i5_edrive40_2026:{x:.69,y:.67,width:.23,height:.045},
  mini_electric_cooper_2026:{x:.26,y:.70,width:.20,height:.045},
  volvo_ex30_2026:{x:.66,y:.70,width:.27,height:.045},
};
// Each model's provenance and license status is recorded in vehicleModelSources.json.
export const vehicleGlbPaths: Record<string, string> = {
  hyundai_ioniq5_lr_2wd_2026:'/assets/vehicles/models/hyundai_ioniq5.glb',
  hyundai_ioniq5_standard_2wd_2026:'/assets/vehicles/models/hyundai_ioniq5.glb',
  hyundai_casper_ev_lr_2026:'/assets/vehicles/models/hyundai_casper_electric.glb',
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
  imagePath:source.publicOriginalPath,cutoutImagePath:`${source.publicCutoutPath}?v=${source.cutoutSourceSha256.slice(0,12)}`,
  resourceOriginalPath:source.resourceOriginalPath,resourceCutoutPath:source.resourceCutoutPath,
  imageSourceUrl:source.sourceUrl,license:source.license,licenseUrl:source.licenseUrl,author:source.author,
  representativeNote:source.representativeNote,glbPath:vehicleGlbPaths[source.vehicleId]??null,
  modelDisplayNote:models.find(m=>m.vehicleId===source.vehicleId)?.displayNote??null,
  renderMode:vehicleGlbPaths[source.vehicleId]?'glb':source.cutoutGenerated?'cutout':'unavailable',
  // PNG fallback was explicitly requested; it stays fixed, without a photo depth stack.
  depthLayerCount:0,extrusionDepth:0,
  downloaded:source.downloaded,cutoutGenerated:source.cutoutGenerated,failureReason:source.failureReason,
  batteryHotspot:photoHotspots[source.vehicleId]??{x:.52,y:.68,width:.22,height:.1},
}));
