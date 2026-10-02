// Window-scoped identity; no changes to the Chrome/Edge executable or normal tabs.
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;
public static class WindowTaskbarIdentity {
    [StructLayout(LayoutKind.Sequential)] public struct Key {
        public Guid format; public uint id;
        public Key(uint value) { format = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"); id = value; }
    }
    [StructLayout(LayoutKind.Sequential)] public struct Value {
        public ushort type, r1, r2, r3; public IntPtr text, padding;
    }
    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface Store {
        [PreserveSig] int GetCount(out uint count);
        [PreserveSig] int GetAt(uint index, out Key key);
        [PreserveSig] int GetValue(ref Key key, out Value value);
        [PreserveSig] int SetValue(ref Key key, ref Value value);
        [PreserveSig] int Commit();
    }
    delegate bool Visitor(IntPtr hwnd, IntPtr data);
    [DllImport("user32.dll")] static extern bool EnumWindows(Visitor visitor, IntPtr data);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int max);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder text, int max);
    [DllImport("shell32.dll", PreserveSig=true)] static extern int SHGetPropertyStoreForWindow(IntPtr hwnd, ref Guid iid, out Store store);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr LoadImage(IntPtr instance, string file, uint type, int width, int height, uint flags);
    [DllImport("user32.dll")] static extern bool DestroyIcon(IntPtr icon);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern IntPtr SendMessageTimeout(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam, uint flags, uint timeout, out IntPtr result);
    static readonly Dictionary<IntPtr, IntPtr[]> windowIcons = new Dictionary<IntPtr, IntPtr[]>();
    static void SetIcons(IntPtr hwnd, string file) {
        if (windowIcons.ContainsKey(hwnd)) return;
        IntPtr small = LoadImage(IntPtr.Zero, file, 1, 32, 32, 0x10);
        IntPtr big = LoadImage(IntPtr.Zero, file, 1, 256, 256, 0x10);
        if (small == IntPtr.Zero || big == IntPtr.Zero) {
            if (small != IntPtr.Zero) DestroyIcon(small);
            if (big != IntPtr.Zero) DestroyIcon(big);
            return;
        }
        // WM_SETICON uses caller-owned handles; keep this hidden helper alive until the window closes.
        windowIcons.Add(hwnd, new IntPtr[] {small, big});
        IntPtr result;
        SendMessageTimeout(hwnd, 0x80, IntPtr.Zero, small, 2, 1000, out result);
        SendMessageTimeout(hwnd, 0x80, new IntPtr(1), big, 2, 1000, out result);
    }
    public static void KeepIconsAlive() {
        while (windowIcons.Count > 0) {
            foreach (IntPtr hwnd in new List<IntPtr>(windowIcons.Keys)) {
                if (IsWindow(hwnd)) continue;
                foreach (IntPtr icon in windowIcons[hwnd]) DestroyIcon(icon);
                windowIcons.Remove(hwnd);
            }
            if (windowIcons.Count > 0) System.Threading.Thread.Sleep(1000);
        }
    }
    static void Put(Store store, uint id, string text) {
        Key key = new Key(id);
        Value value = new Value(); value.type = 31; value.text = Marshal.StringToCoTaskMemUni(text);
        try { Marshal.ThrowExceptionForHR(store.SetValue(ref key, ref value)); }
        finally { Marshal.FreeCoTaskMem(value.text); }
    }
    public static int Apply(int[] processes, string icon, string command) {
        HashSet<int> allowed = new HashSet<int>(processes); int updated = 0;
        EnumWindows(delegate(IntPtr hwnd, IntPtr ignored) {
            uint pid; GetWindowThreadProcessId(hwnd, out pid);
            if (!allowed.Contains((int)pid)) return true;
            StringBuilder title = new StringBuilder(512), cls = new StringBuilder(128);
            GetWindowText(hwnd, title, title.Capacity); GetClassName(hwnd, cls, cls.Capacity);
            if (cls.ToString() != "Chrome_WidgetWin_1" || !title.ToString().StartsWith("Window Starter", StringComparison.Ordinal)) return true;
            SetIcons(hwnd, icon);
            Store store = null;
            try {
                Guid iid = new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99");
                Marshal.ThrowExceptionForHR(SHGetPropertyStoreForWindow(hwnd, ref iid, out store));
                // Relaunch properties precede the explicit ID (Microsoft Shell contract).
                Put(store, 2, command); Put(store, 3, icon + ",0"); Put(store, 4, "Window Starter");
                Put(store, 5, "WindowStarter.Basic"); Marshal.ThrowExceptionForHR(store.Commit()); updated++;
            } catch { /* A closed/inaccessible window must not interrupt launching. */ }
            finally { if (store != null) Marshal.ReleaseComObject(store); }
            return true;
        }, IntPtr.Zero);
        return updated;
    }
}


