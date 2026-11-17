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
 var hud = ui.hud
 await create_timer(0.2).timeout
 check(hud.brand.text=="FORTUNE EMPIRE","Brand name")
 check(not scene.legacy_ui.visible,"Single interface, no duplicate old HUD")
 check(hud.rail.visible,"Desktop investor rail")
 check(hud.top.size.y<150,"Header must leave the board visible")
 check(hud.bottom.position.y+hud.bottom.size.y<=1000,"Desktop footer fits vertically")
 check(hud.top.size.x<=1600 and hud.bottom.size.x<=1600,"HUD fits desktop")
 await capture("preview-empire.png")
 ui.open("portfolio")
 await create_timer(0.2).timeout
 await capture("preview-portfolio.png")
 ui.partner = 1
 ui.selected_give.append(1)
 ui.selected_receive.append(6)
 ui.give_cash = 80
 ui.show_page("draft")
 await create_timer(0.2).timeout
 await capture("preview-trades.png")
 ui.close()
 root.size = Vector2i(390,844)
 await process_frame
 await process_frame
 hud.resize_hud()
 await create_timer(0.2).timeout
 check(not hud.rail.visible,"Phone rail is collapsed")
 check(hud.top.size.x<=366,"Phone header width")
 check(hud.bottom.size.x<=366,"Phone action area width")
 check(hud.bottom.position.y+hud.bottom.size.y<=844,"Phone footer fits vertically")
 check(hud.top.position.y+hud.top.size.y<hud.bottom.position.y,"Header and turn action must not overlap")
 await capture("preview-empire-mobile.png")
 ui.open("portfolio")
 await create_timer(0.2).timeout
 check(ui.window.size.x<=390,"Phone portfolio width")
 await capture("preview-portfolio-mobile.png")
 ui.partner = 1
 ui.selected_give.clear(); ui.selected_give.append(1)
 ui.selected_receive.clear(); ui.selected_receive.append(6)
 ui.show_page("draft")
 await create_timer(0.2).timeout
 check(ui.content.get_combined_minimum_size().x<=ui.window.size.x-44,"Phone trade content width")
 check(ui.footer_actions.get_combined_minimum_size().x<=ui.window.size.x-44,"Phone fixed actions width")
 await capture("preview-trades-mobile.png")
 ui.close()
 check(not hud.action.disabled,"Roll action available")
 hud.action.pressed.emit()
 while scene.moving: await process_frame
 check(scene.turn_phase=="manage","Primary action performs a real roll")
 ui.close()
 hud.action.pressed.emit()
 check(scene.pawns.active==1,"Primary action ends the turn")
 print("PREMIUM UI: ","PASS" if failures==0 else str(failures)+" failures")
 quit(0 if failures==0 else 1)
