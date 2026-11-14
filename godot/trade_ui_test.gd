extends SceneTree
var failures := 0
func check(condition: bool, message: String) -> void:
 if not condition: push_error(message); failures += 1
func _initialize() -> void: call_deferred("run")
func capture(file: String) -> void:
 if DisplayServer.get_name()!="headless":
  await RenderingServer.frame_post_draw
  root.get_texture().get_image().save_png("res://"+file)
func run() -> void:
 root.size = Vector2i(1600,1000)
 var scene = load("res://main.tscn").instantiate()
 root.add_child(scene)
 await process_frame
 scene.orbit = false
 scene.session.seed_demo()
 var ui = scene.trading
 ui.open("trades")
 ui.partner = 1
 ui.selected_give.append(1)
 ui.selected_receive.append(6)
 ui.give_cash = 80
 ui.show_page("draft")
 await create_timer(0.3).timeout
 print("DESKTOP SIZE ",ui.window.size," min ",ui.window.get_combined_minimum_size())
 check(ui.window.size.y<=root.size.y-24,"Desktop modal fits vertically")
 check(ui.portrait_columns.columns==2,"Desktop form in two columns")
 check(ui.window.size.x<=root.size.x,"Desktop modal within viewport")
 await capture("preview-trades.png")
 ui.submit_offer()
 await process_frame
 check(scene.session.offers.size()==1,"UI submits a real offer")
 var offer: Dictionary = scene.session.offers[0]
 ui.review_offer(offer.id,1)
 await process_frame
 await capture("preview-trade-review.png")
 root.size = Vector2i(390,844)
 await process_frame
 await process_frame
 ui.resize_ui()
 ui.show_page("draft")
 await process_frame
 await process_frame
 check(ui.portrait_columns.columns==1,"Phone form in one column")
 check(ui.window.size.x<=390,"Phone modal fits viewport")
 check(ui.content.get_combined_minimum_size().x<=ui.window.size.x-44,"No horizontal overflow on phone")
 await capture("preview-trades-mobile.png")
 ui.review_offer(offer.id,1)
 await process_frame
 check(ui.window.size.x<=390,"Phone review fits viewport")
 var error: String = scene.session.resolve(offer.id,1,"accept")
 check(error.is_empty(),"Accept offer from local recipient")
 check(scene.session.owners[1]==1 and scene.session.owners[6]==0,"UI trade transfers ownership")
 check(scene.owner_markers.has(1),"Board ownership markers exist")
 ui.close()
 root.size = Vector2i(1600,1000)
 await process_frame
 scene.roll()
 # Wait for the real dice and pawn animations, without assuming a frame rate.
 while scene.moving: await process_frame
 check(scene.turn_phase=="manage","Arrival enters management phase")
 check(scene.pawns.active==0,"Mover keeps control until End turn")
 ui.close()
 scene.finish_turn()
 check(scene.pawns.active==1 and scene.turn_phase=="roll","Explicit end turn hands over control")
 print("TRADE UI: ","PASS" if failures==0 else str(failures)+" failures")
 quit(0 if failures==0 else 1)
