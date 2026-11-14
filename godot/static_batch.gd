extends RefCounted
## Merge only immobile, opaque geometry. Animated models keep their hierarchy.
static func bake(scene: Node3D, excluded: Array) -> Dictionary:
 var groups := {}
 var originals: Array[MeshInstance3D] = []
 collect(scene,scene,excluded,groups,originals)
 var batches := 0
 for key in groups:
  var group: Dictionary = groups[key]
  var tool := SurfaceTool.new()
  tool.begin(Mesh.PRIMITIVE_TRIANGLES)
  for entry in group.entries: tool.append_from(entry.mesh,entry.surface,entry.transform)
  var merged := MeshInstance3D.new()
  merged.name = "StaticBatch"
  merged.mesh = tool.commit()
  merged.material_override = group.material
  scene.add_child(merged)
  batches += 1
 for original in originals:
  original.hide()
  original.queue_free()
 return {"originals":originals.size(),"batches":batches}

static func collect(root: Node3D, node: Node, excluded: Array, groups: Dictionary, originals: Array[MeshInstance3D]) -> void:
 if excluded.has(node): return
 if node is MeshInstance3D and node.mesh!=null:
  var mesh: Mesh = node.mesh
  var eligible := true
  for surface in range(mesh.get_surface_count()):
   var material: Material = node.get_active_material(surface)
   if not material is StandardMaterial3D or material.transparency!=BaseMaterial3D.TRANSPARENCY_DISABLED:
    eligible = false
  if eligible:
   originals.append(node)
   for surface in range(mesh.get_surface_count()):
    var m: StandardMaterial3D = node.get_active_material(surface)
    var texture_id: int = m.albedo_texture.get_instance_id() if m.albedo_texture else 0
    var key := str([m.albedo_color,m.metallic,m.roughness,m.emission_enabled,m.emission,m.emission_energy_multiplier,m.shading_mode,m.cull_mode,m.texture_filter,texture_id])
    if not groups.has(key): groups[key] = {"material":m,"entries":[]}
    groups[key].entries.append({"mesh":mesh,"surface":surface,"transform":root.global_transform.affine_inverse()*node.global_transform})
 for child in node.get_children(): collect(root,child,excluded,groups,originals)
