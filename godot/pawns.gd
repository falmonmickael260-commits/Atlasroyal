extends Node3D
## Sculpted tabletop pieces and deterministic, frame-independent movement.
signal crossed_tile(index: int)
signal arrived(piece: int, index: int)
const NAMES = ["Le Roadster", "L'Aviateur", "Le Voilier", "L'Express", "La Couronne", "L'Astrolabe", "Le Cinéaste", "La Fusée"]
const COLORS = [Color("dcbb78"),Color("78cbbb"),Color("8faed4"),Color("c787a3"),Color("db9c62"),Color("88b982"),Color("b19ad1"),Color("c4d3d6")]
var pieces: Array[Node3D] = []
var indices: Array[int] = [0,0,0,0,0,0,0,0]
var active := 0
var busy := false
var track: Array[Vector3] = []
var halo: MeshInstance3D
var last_crossed := 0
var movement_tween: Tween

func material(c: Color, metallic := 0.7) -> StandardMaterial3D:
 var m := StandardMaterial3D.new()
 m.albedo_color = c
 m.metallic = metallic
 m.roughness = 0.28
 return m

func add_mesh(parent: Node3D, shape: Mesh, pos: Vector3, m: Material) -> MeshInstance3D:
 var node := MeshInstance3D.new()
 node.mesh = shape
 node.position = pos
 node.material_override = m
 parent.add_child(node)
 return node

func block(parent: Node3D, p: Vector3, size: Vector3, m: Material) -> MeshInstance3D:
 var shape := BoxMesh.new()
 shape.size = size
 return add_mesh(parent,shape,p,m)

func sphere(parent: Node3D, p: Vector3, size: Vector3, m: Material) -> MeshInstance3D:
 var shape := SphereMesh.new()
 shape.radius = 0.5
 shape.height = 1
 var node := add_mesh(parent,shape,p,m)
 node.scale = size
 return node

func disc(parent: Node3D, p: Vector3, radius: float, height: float, m: Material, top := -1.0) -> MeshInstance3D:
 var shape := CylinderMesh.new()
 shape.bottom_radius = radius
 shape.top_radius = radius if top<0 else top
 shape.height = height
 shape.radial_segments = 48
 return add_mesh(parent,shape,p,m)

func face(parent: Node3D, points: Array[Vector3], m: Material) -> void:
 var shape := ImmediateMesh.new()
 shape.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
 for p in points: shape.surface_add_vertex(p)
 shape.surface_end()
 add_mesh(parent,shape,Vector3.ZERO,m)

func setup(positions: Array[Vector3]) -> void:
 for i in range(40):
  var outward := Vector3(0,0,0.56).rotated(Vector3.UP,-float(i/10)*PI/2)
  track.append(positions[i]+outward+Vector3(0,0.37,0))
 for i in range(8):
  var root := Node3D.new()
  root.name = NAMES[i]
  add_child(root)
  pieces.append(root)
  var metal := material(COLORS[i])
  var dark := material(Color("162931"),0.4)
  var trim := material(Color("e6dbc0"),0.65)
  # Low medallion and colored rim identify the player without hiding the sculpt.
  disc(root,Vector3(0,0.025,0),0.20,0.05,dark)
  disc(root,Vector3(0,0.054,0),0.185,0.012,metal)
  var body := Node3D.new()
  body.name = "Sculpture"
  root.add_child(body)
  if i==0:
   # Long bonnet, open cockpit, radiator, lamps and four brass wheels.
   sphere(body,Vector3(0,0.15,-0.04),Vector3(0.23,0.12,0.49),metal)
   block(body,Vector3(0,0.20,-0.11),Vector3(0.21,0.11,0.23),metal)
   block(body,Vector3(0,0.23,0.09),Vector3(0.16,0.04,0.15),dark)
   var screen := block(body,Vector3(0,0.28,0),Vector3(0.20,0.12,0.015),trim)
   screen.rotation.x = -0.22
   block(body,Vector3(0,0.17,-0.25),Vector3(0.19,0.12,0.025),trim)
   for x in [-0.13,0.13]:
    for z in [-0.16,0.15]:
     var wheel := disc(body,Vector3(x,0.12,z),0.068,0.04,dark)
     wheel.rotation.z = PI/2
     wheel.set_meta("radius",0.068 if i==0 else 0.062)
     add_spokes(wheel,metal)
     var hub := disc(body,Vector3(x*1.18,0.12,z),0.032,0.01,metal)
     hub.rotation.z = PI/2
     if z<0:
      var steering := Node3D.new()
      steering.position = wheel.position
      steering.set_meta("steering",true)
      body.add_child(steering)
      wheel.reparent(steering,true)
      hub.reparent(steering,true)
    sphere(body,Vector3(x*0.7,0.19,-0.27),Vector3.ONE*0.045,trim)
  elif i==1:
   # Biplane, two stacked wings, struts, tailplane and working propeller.
   sphere(body,Vector3(0,0.25,0),Vector3(0.12,0.12,0.48),metal)
   for h in [0.22,0.36]:
    var wing := sphere(body,Vector3(0,h,-0.03),Vector3(0.53,0.035,0.13),metal)
    wing.name = "Aile"
   for x in [-0.19,0.19]: block(body,Vector3(x,0.29,-0.03),Vector3(0.012,0.14,0.012),trim)
   sphere(body,Vector3(0,0.27,0.19),Vector3(0.24,0.025,0.09),trim)
   block(body,Vector3(0,0.31,0.19),Vector3(0.018,0.13,0.1),metal)
   var prop := Node3D.new()
   prop.name = "Propeller"
   prop.position = Vector3(0,0.25,-0.26)
   body.add_child(prop)
   block(prop,Vector3.ZERO,Vector3(0.015,0.24,0.02),trim)
   disc(body,Vector3(0,0.11,0),0.055,0.11,dark)
  elif i==2:
   # Shaped hull, deck, mast, boom and two real triangular sails.
   sphere(body,Vector3(0,0.13,0),Vector3(0.22,0.16,0.46),metal)
   sphere(body,Vector3(0,0.19,0),Vector3(0.20,0.035,0.4),trim)
   disc(body,Vector3(0,0.40,0),0.012,0.50,trim)
   block(body,Vector3(0,0.23,0.1),Vector3(0.014,0.015,0.24),trim)
   var sail := material(COLORS[i].lightened(0.25),0.35)
   sail.cull_mode = BaseMaterial3D.CULL_DISABLED
   face(body,[Vector3(0,0.65,0),Vector3(0,0.25,0.19),Vector3(0.025,0.25,0)],sail)
   face(body,[Vector3(0,0.59,-0.025),Vector3(0.015,0.25,-0.2),Vector3(0,0.25,-0.025)],metal)
  elif i==3:
   # Steam locomotive: boiler, chimney, cabin, cowcatcher, six wheels.
   var boiler := disc(body,Vector3(0,0.22,-0.07),0.10,0.31,metal)
   boiler.rotation.x = PI/2
   block(body,Vector3(0,0.17,0),Vector3(0.23,0.07,0.48),metal)
   block(body,Vector3(0,0.28,0.14),Vector3(0.23,0.20,0.16),metal)
   block(body,Vector3(0,0.39,0.14),Vector3(0.29,0.035,0.21),trim)
   for x in [-0.12,0.12]: block(body,Vector3(x,0.31,0.14),Vector3(0.006,0.08,0.08),dark)
   disc(body,Vector3(0,0.36,-0.16),0.04,0.16,trim,0.06)
   for x in [-0.14,0.14]:
    for z in [-0.17,0,0.17]:
     var wheel := disc(body,Vector3(x,0.12,z),0.062,0.025,dark)
     wheel.rotation.z = PI/2
     wheel.set_meta("radius",0.068 if i==0 else 0.062)
     add_spokes(wheel,metal)
   block(body,Vector3(0,0.14,-0.28),Vector3(0.24,0.04,0.10),trim).rotation.x = 0.35
  elif i==4:
   # Eight-point royal crown, velvet interior, pearls and colored gemstones.
   disc(body,Vector3(0,0.17,0),0.17,0.18,metal,0.21)
   disc(body,Vector3(0,0.28,0),0.16,0.035,material(Color("52364e"),0.1))
   for h in [0.09,0.22]: disc(body,Vector3(0,h,0),0.185,0.027,trim)
   for j in range(8):
    var angle := j*TAU/8
    var x := sin(angle)*0.17
    var z := cos(angle)*0.17
    var point := disc(body,Vector3(x,0.31,z),0.047,0.20,metal,0)
    point.rotation.z = -sin(angle)*0.2
    point.rotation.x = cos(angle)*0.2
    sphere(body,Vector3(x,0.43,z),Vector3.ONE*0.047,trim)
    sphere(body,Vector3(x*1.10,0.17,z*1.10),Vector3(0.045,0.065,0.045),material(Color("73c8b4"),0.3))
  elif i==5:
   # Tilted scientific instrument with concentric rings, dial and compass needle.
   var instrument := Node3D.new()
   instrument.position.y = 0.25
   instrument.rotation.x = -0.45
   body.add_child(instrument)
   disc(body,Vector3(0,0.13,0),0.075,0.14,trim)
   disc(instrument,Vector3.ZERO,0.205,0.04,metal)
   disc(instrument,Vector3(0,0.024,0),0.176,0.014,dark)
   for j in range(16):
    var a := j*TAU/16
    var tick := block(instrument,Vector3(sin(a)*0.15,0.04,cos(a)*0.15),Vector3(0.009,0.008,0.03 if j%4==0 else 0.015),trim)
    tick.rotation.y = a
   var needle := block(instrument,Vector3(0,0.053,0),Vector3(0.035,0.016,0.26),metal)
   needle.rotation.y = 0.45
   needle.set_meta("needle",true)
   sphere(instrument,Vector3(0,0.07,0),Vector3.ONE*0.035,trim)
   var ring := TorusMesh.new()
   ring.inner_radius = 0.21
   ring.outer_radius = 0.23
   add_mesh(instrument,ring,Vector3.ZERO,trim)
   disc(body,Vector3(0,0.47,0.10),0.05,0.04,metal).rotation.x = PI/2
  elif i==6:
   # Cinema camera: tripod, lens barrel, perforated film reels and crank.
   for j in range(3):
    var a := j*TAU/3
    var leg := block(body,Vector3(sin(a)*0.08,0.15,cos(a)*0.08),Vector3(0.02,0.20,0.02),trim)
    leg.rotation.x = cos(a)*0.5
    leg.rotation.z = -sin(a)*0.5
   block(body,Vector3(0,0.32,0),Vector3(0.22,0.19,0.25),metal)
   var lens := disc(body,Vector3(0,0.33,-0.19),0.068,0.15,trim)
   lens.rotation.x = PI/2
   sphere(body,Vector3(0,0.33,-0.275),Vector3(0.095,0.095,0.022),material(Color("254854"),0.5))
   for z in [-0.09,0.09]:
    var reel := disc(body,Vector3(0,0.49,z),0.085,0.055,metal)
    reel.rotation.z = PI/2
    for hole in range(5):
     var a := hole*TAU/5
     sphere(body,Vector3(0.03,0.49+sin(a)*0.05,z+cos(a)*0.05),Vector3(0.005,0.023,0.023),dark)
   block(body,Vector3(-0.15,0.33,0.06),Vector3(0.10,0.015,0.015),trim)
   block(body,Vector3(-0.20,0.36,0.06),Vector3(0.015,0.08,0.015),trim)
  else:
   # Retro rocket with swept fins, portholes and a separate exhaust flame.
   disc(body,Vector3(0,0.31,0),0.085,0.38,metal)
   disc(body,Vector3(0,0.57,0),0.086,0.16,trim,0)
   for h in [0.15,0.27,0.45]: disc(body,Vector3(0,h,0),0.089,0.022,trim)
   sphere(body,Vector3(0,0.39,-0.081),Vector3(0.085,0.085,0.023),dark)
   for j in range(3):
    var fin := Node3D.new()
    body.add_child(fin)
    fin.rotation.y = j*TAU/3
    var fin_mat := material(COLORS[7].darkened(0.3))
    fin_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
    face(fin,[Vector3(0.07,0.29,0),Vector3(0.19,0.09,0),Vector3(0.07,0.12,0)],fin_mat)
   var flame := sphere(body,Vector3(0,0.105,0),Vector3(0.06,0.14,0.06),material(Color("f0bd72"),0.1))
   flame.name = "Flame"
   flame.visible = false

 relayout()
 var ring := TorusMesh.new()
 ring.inner_radius = 0.23
 ring.outer_radius = 0.255
 halo = add_mesh(self,ring,Vector3.ZERO,material(COLORS[0],0.3))

func add_spokes(wheel: MeshInstance3D, metal: Material) -> void:
 for angle in [0.0,PI/2]:
  var spoke := block(wheel,Vector3(0,0.022,0),Vector3(0.1,0.008,0.012),metal)
  spoke.rotation.y = angle

func slot(piece: int, tile: int) -> Vector3:
 var occupants: Array[int] = []
 for i in range(8):
  if indices[i]==tile: occupants.append(i)
 if occupants.size()<=1: return Vector3.ZERO
 var rank := occupants.find(piece)
 var column := rank%3
 var row := rank/3
 var offset := Vector3((column-1)*0.56,0,(row-1)*0.56-0.56)
 return offset.rotated(Vector3.UP,-float(tile/10)*PI/2)

func relayout() -> void:
 for i in range(8):
  pieces[i].position = track[indices[i]]+slot(i,indices[i])
  var forward := track[(indices[i]+1)%40]-track[indices[i]]
  pieces[i].rotation.y = atan2(-forward.x,-forward.z)

func sample_track(progress: float) -> Vector3:
 var index := int(floor(progress))
 var t := progress-floorf(progress)
 var a: Vector3 = track[posmod(index-1,40)]
 var b: Vector3 = track[posmod(index,40)]
 var c: Vector3 = track[posmod(index+1,40)]
 var d: Vector3 = track[posmod(index+2,40)]
 # Catmull-Rom interpolation keeps the piece on a continuous rounded route.
 return 0.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)

func apply_progress(value: float, piece: int, start: int, steps: int, origin_offset: Vector3) -> void:
 var normalized := (value-float(start))/float(steps)
 var pos := sample_track(value)
 pos += origin_offset*pow(1.0-clampf((value-start)/0.7,0.0,1.0),3)
 var forward := sample_track(value+0.02)-sample_track(value)
 var target_yaw := atan2(-forward.x,-forward.z)
 var distance_travelled := pieces[piece].position.distance_to(pos)
 pieces[piece].position = pos
 pieces[piece].rotation.y = target_yaw
 var visual := pieces[piece].get_node("Sculpture") as Node3D
 var wave := sin(normalized*PI)
 visual.position.y = wave*(0.20 if piece==7 else (0.12 if piece==1 else 0.018))
 var ahead := sample_track(value+0.10)-sample_track(value+0.08)
 var turn := wrapf(atan2(-ahead.x,-ahead.z)-target_yaw,-PI,PI)
 visual.rotation.z = clampf(-turn*(2.2 if piece==1 else 1.2),-0.20,0.20)*wave
 var launch := sin(clampf(normalized/0.18,0,1)*PI) if normalized<0.18 else 0.0
 var brake := sin(clampf((normalized-0.82)/0.18,0,1)*PI) if normalized>0.82 else 0.0
 visual.rotation.x = (launch-brake)*0.055
 if piece==0 or piece==3:
  visual.position.y = sin(value*TAU*2)*0.006*wave
 elif piece==2:
  visual.rotation.z += sin(value*PI*1.5)*0.065*wave
  visual.rotation.x += sin(value*PI)*0.035*wave
 elif piece==4:
  visual.rotation.y = sin(normalized*PI)*0.08
 elif piece==6:
  visual.rotation.y = sin(normalized*TAU)*0.06
 elif piece==7:
  visual.rotation.x += wave*0.10
 for pivot in visual.get_children():
  if pivot.has_meta("steering"): pivot.rotation.y = clampf(-turn*1.8,-0.24,0.24)
 for part in visual.find_children("*","MeshInstance3D",true,false):
  if part.has_meta("radius"):
   part.rotate_object_local(Vector3.UP,distance_travelled/float(part.get_meta("radius")))
  if part.has_meta("needle"): part.rotation.y = 0.45+wave*sin(value*PI)*0.45
 var crossed := mini(start+steps,int(floor(value+0.0001)))
 while last_crossed<crossed:
  last_crossed += 1
  crossed_tile.emit(posmod(last_crossed,40))

func move_active(steps: int, duration_scale := 1.0) -> bool:
 if busy or steps<1 or steps>40: return false
 busy = true
 var piece := active
 var start := indices[piece]
 var offset := slot(piece,start)
 last_crossed = start
 var visual := pieces[piece].get_node("Sculpture") as Node3D
 var prepare := create_tween()
 prepare.tween_property(visual,"rotation:x",0.055,maxf(0.01,0.13*duration_scale)).set_trans(Tween.TRANS_SINE)
 await prepare.finished
 var duration := (0.45+steps*0.20)*duration_scale
 movement_tween = create_tween()
 movement_tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
 movement_tween.tween_method(func(v: float): apply_progress(v,piece,start,steps,offset),float(start),float(start+steps),maxf(0.01,duration))
 await movement_tween.finished
 indices[piece] = posmod(start+steps,40)
 # Place all occupants precisely in non-overlapping parking slots.
 var landing := create_tween().set_parallel(true)
 for i in range(8):
  landing.tween_property(pieces[i],"position",track[indices[i]]+slot(i,indices[i]),maxf(0.01,0.20*duration_scale)).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
  var settling := pieces[i].get_node("Sculpture") as Node3D
  for pivot in settling.get_children():
   if pivot.has_meta("steering"): landing.tween_property(pivot,"rotation:y",0.0,maxf(0.01,0.20*duration_scale))
  landing.tween_property(settling,"rotation",Vector3.ZERO,maxf(0.01,0.20*duration_scale))
  landing.tween_property(settling,"position",Vector3.ZERO,maxf(0.01,0.20*duration_scale))
 await landing.finished
 arrived.emit(piece,indices[piece])
 active = (active+1)%8
 busy = false
 return true

func _process(delta: float) -> void:
 if is_instance_valid(halo):
  halo.position = pieces[active].position+Vector3(0,0.018,0)
  halo.material_override.albedo_color = COLORS[active]
  var pulse := 1.0+sin(Time.get_ticks_msec()*0.004)*0.06
  halo.scale = Vector3(pulse,1,pulse)
 for piece in pieces:
  var prop := piece.get_node_or_null("Sculpture/Propeller") as Node3D
  if prop: prop.rotation.z += delta*(32 if busy and pieces[active]==piece else 4)
  var flame := piece.get_node_or_null("Sculpture/Flame") as Node3D
  if flame:
   flame.visible = busy and pieces[active]==piece
   flame.scale.y = 1.0+sin(Time.get_ticks_msec()*0.03)*0.15
