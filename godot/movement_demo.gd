extends SceneTree
func _initialize() -> void: call_deferred("run")
func run() -> void:
 root.size = Vector2i(1280,800)
 var scene = load("res://main.tscn").instantiate()
 root.add_child(scene)
 await process_frame
 scene.orbit = false
 scene.session.seed_demo()
 scene.pawns.indices[0] = 8
 scene.pawns.relayout()
 # A reproducible demo roll; the production game still draws its values normally.
 for seed_value in range(10000):
  scene.rng.seed = seed_value
  if scene.rng.randi_range(1,6)==3 and scene.rng.randi_range(1,6)==4:
   scene.rng.seed = seed_value
   break
 await create_timer(0.5).timeout
 scene.roll()
 while scene.moving: await process_frame
 await create_timer(1.0).timeout
 print("MOVEMENT DEMO: ",scene.dice_values," · crossed ",scene.steps_moved," cases")
 quit()
