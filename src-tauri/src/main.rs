#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod google_calendar_oauth;
mod notis;
mod oauth_loopback;
mod open_cognition_macro;
mod spotify_oauth;
mod user_themes;

use tauri::{
    menu::{AboutMetadata, AboutMetadataBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    Emitter,
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .plugin(tauri_plugin_notification::init())
        .manage(notis::Queue::default())
        .invoke_handler(tauri::generate_handler![
            open_cognition_macro::open_cognition_bar,
            open_cognition_macro::hide_cognition_bar,
            spotify_oauth::spotify_oauth_listen,
            google_calendar_oauth::google_oauth_listen,
            notis::schedule_notification,
            notis::cancel_notification,
            notis::send_notification,
            notis::sync_notifications,
            user_themes::list_user_themes,
            user_themes::save_user_theme,
            user_themes::delete_user_theme,
            user_themes::open_user_themes_folder,
            user_themes::create_new_theme,
        ])
        .setup(|app| {
            notis::start_scheduler(app.handle().clone());
            #[cfg(desktop)]
            open_cognition_macro::register_shortcut(app.handle())?;

            let about_metadata = AboutMetadataBuilder::new()
                .version(Some("0.1.0 Beta"))
                .authors(Some(vec!["Joshua Rashtian".to_string()]))
                .comments(Some("DayByDay — segment-based day planning"))
                .copyright(Some("© 2026 Joshua Rashtian"))
                .build();

            let settings_item = MenuItemBuilder::with_id("settings", "Settings...")
                .accelerator("CmdOrCtrl+,")
                .build(app)?;

            let app_menu = SubmenuBuilder::new(app, app.package_info().name.clone())
                .about(Some(about_metadata))
                .separator()
                .item(&settings_item)
                .separator()
                .quit()
                .build()?;

            let create_task_item = MenuItemBuilder::with_id("create_task", "Create Task")
                .accelerator("CmdOrCtrl+N")
                .build(app)?;
            let task_menu = SubmenuBuilder::new(app, "Tasks")
                .item(&create_task_item)
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let zoom_in_item = MenuItemBuilder::with_id("zoom_in", "Zoom In")
                .accelerator("CmdOrCtrl+=")
                .build(app)?;
            let zoom_out_item = MenuItemBuilder::with_id("zoom_out", "Zoom Out")
                .accelerator("CmdOrCtrl+-")
                .build(app)?;
            let actual_size_item = MenuItemBuilder::with_id("zoom_reset", "Actual Size")
                .accelerator("CmdOrCtrl+0")
                .build(app)?;
            let toggle_left_panel =
                MenuItemBuilder::with_id("toggle_left_panel", "Toggle Left Panel")
                    .accelerator("CmdOrCtrl+1")
                    .build(app)?;
            let toggle_right_panel =
                MenuItemBuilder::with_id("toggle_right_panel", "Toggle Right Panel")
                    .accelerator("CmdOrCtrl+2")
                    .build(app)?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .item(&zoom_in_item)
                .item(&zoom_out_item)
                .item(&actual_size_item)
                .separator()
                .item(&toggle_left_panel)
                .item(&toggle_right_panel)
                .build()?;

            let go_menu = SubmenuBuilder::new(app, "Go")
                .text("home", "Home")
                .text("calendar", "Calendar")
                .text("tasks", "Tasks")
                .text("blocks", "Blocks")
                .text("pomodoro", "Pomodoro")
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .item(&task_menu)
                .item(&go_menu)
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle: &tauri::AppHandle, event| {
                match event.id().0.as_str() {
                    "home" => {
                        let _ = app_handle.emit("navigate", "home");
                    }
                    "calendar" => {
                        let _ = app_handle.emit("navigate", "calendar");
                    }
                    "tasks" => {
                        let _ = app_handle.emit("navigate", "tasks");
                    }
                    "blocks" => {
                        let _ = app_handle.emit("navigate", "blocks");
                    }
                    "pomodoro" => {
                        let _ = app_handle.emit("navigate", "pomodoro");
                    }
                    "settings" => {
                        let _ = app_handle.emit("navigate", "settings");
                    }
                    "create_task" => {
                        let _ = app_handle.emit("create-task", ());
                    }
                    "zoom_in" => {
                        let _ = app_handle.emit("menu-zoom", "in");
                    }
                    "zoom_out" => {
                        let _ = app_handle.emit("menu-zoom", "out");
                    }
                    "zoom_reset" => {
                        let _ = app_handle.emit("menu-zoom", "reset");
                    }
                    "toggle_left_panel" => {
                        let _ = app_handle.emit("toggle-left-panel", ());
                    }
                    "toggle_right_panel" => {
                        let _ = app_handle.emit("toggle-right-panel", ());
                    }
                    _ => {
                        // Ignore unrelated native menu events.
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri app");
}
