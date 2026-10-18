package com.maimai.xiaobao;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 把別的 App（例如 IG）分享進來的文字交給網頁。
 * 網頁用 take() 取走，或監聽 "shared" 事件。
 */
@CapacitorPlugin(name = "ShareTarget")
public class ShareTargetPlugin extends Plugin {

    private static String pending;

    /** MainActivity 收到分享時呼叫 */
    static void receive(Plugin instance, String text) {
        pending = text;
        if (instance instanceof ShareTargetPlugin) {
            JSObject data = new JSObject();
            data.put("text", text);
            ((ShareTargetPlugin) instance).notifyListeners("shared", data, true);
        }
    }

    @PluginMethod
    public void take(PluginCall call) {
        JSObject result = new JSObject();
        result.put("text", pending);
        pending = null;
        call.resolve(result);
    }
}
