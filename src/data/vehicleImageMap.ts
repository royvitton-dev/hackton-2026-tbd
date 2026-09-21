import sources from './vehicleImageSources.json';
import type { VehicleImage } from '../types/vehicle';
// Add a licensed model here after copying it into resoures/images/models and syncing.
export const vehicleGlbPaths: Record<string, string> = {
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
  renderMode:vehicleGlbPaths[source.vehicleId]?'glb':'unavailable',
  // Retained source metadata; photo depth stacks are explicitly disabled by the revised requirement.
  depthLayerCount:0,extrusionDepth:0,
  downloaded:source.downloaded,cutoutGenerated:source.cutoutGenerated,failureReason:source.failureReason,
  batteryHotspot:{x:.52,y:.68,width:.22,height:.1},
}));
