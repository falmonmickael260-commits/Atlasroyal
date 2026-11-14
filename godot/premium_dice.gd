extends Node3D
## Directed dice animation. The final transform is derived from the chosen values.
var dice: Array[Node3D] = []
var result: Array[int] = [1,1]
var busy := false
var roots: Array[Vector3] = [Vector3(-0.65,0.71,-3.6),Vector3(0.65,0.71,-3.6)]
const NORMALS = [Vector3.UP,Vector3.FORWARD,Vector3.RIGHT,Vector3.LEFT,Vector3.BACK,Vector3.DOWN]
var target_rotations: Array[Quaternion] = []
var tween: Tween
var impact: AudioStreamPlayer
var hit_first := false
var hit_second := false
var muted := false

func _ready() -> void:
 var shell := StandardMaterial3D.new()
 shell.albedo_color = Color("e5ddc7")
 shell.metallic = 0.10
 shell.roughness = 0.30
 shell.emission_enabled = true
 shell.emission = Color("b5b0a0")
 shell.emission_energy_multiplier = 0.16
 shell.cull_mode = BaseMaterial3D.CULL_DISABLED
 var ink := StandardMaterial3D.new()
 ink.albedo_color = Color("122c35")
 ink.roughness = 0.7
 var gold := StandardMaterial3D.new()
 gold.albedo_color = Color("a99263")
 gold.metallic = 0.65
 gold.roughness = 0.35
 var rounded := rounded_cube()
 for i in range(2):
  var body := Node3D.new()
  add_child(body)
  body.position = roots[i]
  dice.append(body)
  var cube := MeshInstance3D.new()
  cube.mesh = rounded
  cube.material_override = shell
  body.add_child(cube)
  for value in range(1,7):
   var normal: Vector3 = NORMALS[value-1]
   var u := Vector3.RIGHT if absf(normal.y)>0.5 else Vector3.UP
   var v := normal.cross(u)
   var points: Array[Vector2] = []
   if value%2==1: points.append(Vector2.ZERO)
   if value>=2: points.append_array([Vector2(-1,-1),Vector2(1,1)])
   if value>=4: points.append_array([Vector2(-1,1),Vector2(1,-1)])
   if value==6: points.append_array([Vector2(-1,0),Vector2(1,0)])
   for pt in points:
    for layer in range(2):
     var mark := CylinderMesh.new()
     mark.height = 0.004
     mark.top_radius = 0.047 if layer==0 else 0.038
     mark.bottom_radius = mark.top_radius
     mark.radial_segments = 24
     var dot := MeshInstance3D.new()
     dot.mesh = mark
     dot.material_override = gold if layer==0 else ink
     dot.position = normal*(0.376+layer*0.003)+u*pt.x*0.18+v*pt.y*0.18
     dot.quaternion = Quaternion(Vector3.UP,normal)
     body.add_child(dot)
 impact = AudioStreamPlayer.new()
 impact.volume_db = -25
 impact.stream = make_tap()
 add_child(impact)

func rounded_cube() -> ArrayMesh:
 var vertices := PackedVector3Array()
 var normals := PackedVector3Array()
 const HALF = 0.375
 const CORE = 0.31
 const STEPS = 12
 for face_normal in NORMALS:
  var n: Vector3 = face_normal
  var u := Vector3.RIGHT if absf(n.y)>0.5 else Vector3.UP
  var v := n.cross(u)
  for y in range(STEPS):
   for x in range(STEPS):
    for offset in [Vector2i(0,0),Vector2i(1,0),Vector2i(1,1),Vector2i(0,0),Vector2i(1,1),Vector2i(0,1)]:
     var point: Vector3 = n*HALF+u*lerpf(-HALF,HALF,float(x+offset.x)/STEPS)+v*lerpf(-HALF,HALF,float(y+offset.y)/STEPS)
     var core := point.clamp(Vector3.ONE*-CORE,Vector3.ONE*CORE)
     var smooth_normal := (point-core).normalized()
     vertices.append(core+smooth_normal*(HALF-CORE))
     normals.append(smooth_normal)
 var arrays := []
 arrays.resize(Mesh.ARRAY_MAX)
 arrays[Mesh.ARRAY_VERTEX] = vertices
 arrays[Mesh.ARRAY_NORMAL] = normals
 var shape := ArrayMesh.new()
 shape.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
 return shape

func orientation_for(value: int, yaw := 0.0) -> Quaternion:
 return Quaternion(Vector3.UP,yaw)*Quaternion(NORMALS[value-1],Vector3.UP)

func top_value(index: int) -> int:
 var best := -2.0
 var value := 1
 for face in range(6):
  var height: float = (dice[index].basis*NORMALS[face]).dot(Vector3.UP)
  if height>best: best = height; value = face+1
 return value

func top_values() -> Array[int]: return [top_value(0),top_value(1)]

func sample_roll(t: float) -> void:
 for i in range(2):
  var direction := -1.0 if i==0 else 1.0
  var p := 1.0-pow(1.0-t,3)
  dice[i].position = roots[i]+Vector3(direction*1.7*(1-p),0,2.4*(1-p))
  var height := 0.0
  if t<0.55:
   var u := t/0.55
   height = 0.9*(1-u)+sin(u*PI)*1.0
  else:
   var v := (t-0.55)/0.45
   height = absf(sin(v*TAU))*0.25*(1-v)
  dice[i].position.y += height
  var spin := Quaternion.from_euler(Vector3(minf(t,0.72)*TAU*(3+i),t*0.2,minf(t,0.72)*TAU*(2-i)*direction))
  if t<0.72: dice[i].quaternion = spin
  else:
   var stop := Quaternion.from_euler(Vector3(0.72*TAU*(3+i),0.72*0.2,0.72*TAU*(2-i)*direction))
   var settle := smoothstep(0.72,1.0,t)
   dice[i].quaternion = stop.slerp(target_rotations[i],settle)
 if t>=0.55 and not hit_first:
  hit_first = true
  if not muted: impact.play()
 if t>=0.78 and not hit_second:
  hit_second = true
  if not muted: impact.play()

func roll_pair(a: int, b: int, duration := 1.45) -> bool:
 if busy or a<1 or a>6 or b<1 or b>6: return false
 busy = true
 result = [a,b]
 target_rotations = [orientation_for(a,0.12),orientation_for(b,-0.18)]
 hit_first = false; hit_second = false
 tween = create_tween()
 tween.tween_method(sample_roll,0.0,1.0,maxf(0.01,duration))
 await tween.finished
 for i in range(2):
  dice[i].position = roots[i]
  dice[i].quaternion = target_rotations[i]
 busy = false
 return top_values()==result

func make_tap() -> AudioStreamWAV:
 var bytes := PackedByteArray()
 var rng := RandomNumberGenerator.new()
 rng.seed = 19
 var count := 1600
 bytes.resize(count*2)
 for i in range(count):
  var time := float(i)/22050.0
  var value := (sin(time*TAU*230)*0.4+rng.randf_range(-1,1)*0.6)*exp(-time*95.0)
  bytes.encode_s16(i*2,int(value*12000))
 var sound := AudioStreamWAV.new()
 sound.format = AudioStreamWAV.FORMAT_16_BITS
 sound.mix_rate = 22050
 sound.data = bytes
 return sound
