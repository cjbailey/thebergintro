#define PHYSICAL

varying vec3 vViewPosition;

#ifndef FLAT_SHADED

	varying vec3 vNormal;

#endif

#include <common>
#include <uv_pars_vertex>
#include <uv2_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

uniform sampler2D heightMap;
// uniform sampler2D normalMap;
uniform vec3 playerPos;
uniform float mapSize;
uniform float viewSize;
uniform float subdivisions;
uniform float textureSize;
uniform float heightScale;

void main() {

	#include <uv_vertex>
	#include <uv2_vertex>
	#include <color_vertex>
	#include <beginnormal_vertex>
	#include <defaultnormal_vertex>

#ifndef FLAT_SHADED // Normal computed with derivatives when FLAT_SHADED

	vNormal = normalize( transformedNormal );

#endif

	float step = viewSize / subdivisions;
	vec2 pp = vec2(playerPos.x, -playerPos.z);
	vec2 adjPlayerPos = floor(pp / step) * step;
	vec2 remainderPP = pp - adjPlayerPos;

	float uvScale = viewSize / mapSize;
	vec2 uvOffset = vec2(adjPlayerPos + (mapSize / 2.) - (viewSize / 2.)) / mapSize;
	vec2 newUV = uvOffset + uv * uvScale;

	vec4 dm = texture2D(heightMap, newUV);
	vec3 newPos = vec3( position.x - remainderPP.x, position.y - remainderPP.y, dm.r * heightScale );
	vec3 transformed = newPos;

	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>

	vViewPosition = - mvPosition.xyz;

	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>

}
