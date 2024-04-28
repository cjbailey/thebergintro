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
uniform vec3 playerPos;
uniform float mapSize;
uniform float viewSize;
uniform float subdivisions;
uniform float heightScale;
uniform float nSeaLevel;
uniform float time;
uniform float waveFreq;
uniform vec2 waveOrigin[3];


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

	float dOffset = 0.01;
	vec2 depths = vec2(0);
	depths.x = clamp(nSeaLevel - texture2D(heightMap, newUV + vec2(-dOffset, -dOffset)).r, 0., nSeaLevel) / nSeaLevel;
	depths.y = clamp(nSeaLevel - texture2D(heightMap, newUV + vec2(dOffset, dOffset)).r, 0., nSeaLevel) / nSeaLevel;
	float avDepth = (depths.x + depths.y) / 2.;

	float displace = 0.;
	vec2 t;
	for (int i = 0; i < 3; i++) {
		float waveOriginDist = distance( waveOrigin[i], newUV );
		displace += cos( waveFreq * ( 1. / float(i + 1) ) * waveOriginDist + (time * 2.)) * avDepth;
		displace += cos( waveFreq * avDepth * 2.5 * waveOriginDist - (time * 1.5) ) * 0.75;

		t += normalize(newUV - waveOrigin[i]) * cos(time * 0.1);
	}
	// displace *= avDepth;
	t *= 10.;

	vec2 adjVertPos = vec2( position.x - remainderPP.x, position.y - remainderPP.y );
	vec3 newPos = vec3( adjVertPos.x + t.x, adjVertPos.y + t.y, displace * heightScale );
	vec3 transformed = newPos;

	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>

	vViewPosition = - mvPosition.xyz;

	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>

}
