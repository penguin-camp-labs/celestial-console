// Shade the far hemisphere in the vertex/fragment pipeline, including lines.
// Shared uniforms follow the external camera; disabled in 2D and ground view.
export function configureDepthDimming(material,uniforms){
 if(material.userData.depthDimming)return;
 material.userData.depthDimming=true;material.transparent=true;
 material.onBeforeCompile=shader=>{
  shader.uniforms.hemisphereAmount=uniforms.amount;shader.uniforms.hemisphereDirection=uniforms.direction;
  shader.vertexShader='uniform vec3 hemisphereDirection;\nvarying float hemisphereDepth;\n'+shader.vertexShader.replace('#include <fog_vertex>','#include <fog_vertex>\nhemisphereDepth = dot((modelMatrix * vec4(position, 1.0)).xyz, hemisphereDirection);');
  shader.fragmentShader='uniform float hemisphereAmount;\nvarying float hemisphereDepth;\n'+shader.fragmentShader.replace('#include <opaque_fragment>','float rearAmount = hemisphereAmount * (1.0 - smoothstep(-32.0, 32.0, hemisphereDepth));\noutgoingLight *= 1.0 - 0.2 * rearAmount;\ndiffuseColor.a *= 1.0 - 0.55 * rearAmount;\n#include <opaque_fragment>');
 };
 material.customProgramCacheKey=()=> 'celestial-hemisphere-v1';material.needsUpdate=true;
}
