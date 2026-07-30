//go:build windows

package main

import (
	"encoding/json"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
)

// Raw SendInput bindings. golang.org/x/sys/windows doesn't wrap SendInput/INPUT, so this
// mirrors the well-known Win32 ABI layout by hand: INPUT is `{DWORD type; <8-byte pad on
// amd64>; union{MOUSEINPUT, KEYBDINPUT, HARDWAREINPUT}}`, and the union is sized to its
// largest member (MOUSEINPUT, 32 bytes on amd64 once ULONG_PTR dwExtraInfo forces 8-byte
// alignment) - giving sizeof(INPUT) == 40, matching the documented Win32 struct exactly.
var (
	user32           = windows.NewLazySystemDLL("user32.dll")
	procSendInput    = user32.NewProc("SendInput")
	procGetSysMetric = user32.NewProc("GetSystemMetrics")
)

const (
	inputMouse    uint32 = 0
	inputKeyboard uint32 = 1

	mouseEventFMove        uint32 = 0x0001
	mouseEventFAbsolute    uint32 = 0x8000
	mouseEventFVirtualDesk uint32 = 0x4000
	mouseEventFLeftDown    uint32 = 0x0002
	mouseEventFLeftUp      uint32 = 0x0004
	mouseEventFRightDown   uint32 = 0x0008
	mouseEventFRightUp     uint32 = 0x0010
	mouseEventFMiddleDown  uint32 = 0x0020
	mouseEventFMiddleUp    uint32 = 0x0040
	mouseEventFWheel       uint32 = 0x0800

	keyEventFKeyUp uint32 = 0x0002

	smCXVirtualScreen = 78
	smCYVirtualScreen = 79
)

type mouseInputData struct {
	dx          int32
	dy          int32
	mouseData   uint32
	dwFlags     uint32
	time        uint32
	dwExtraInfo uintptr
}

type keybdInputData struct {
	wVk         uint16
	wScan       uint16
	dwFlags     uint32
	time        uint32
	dwExtraInfo uintptr
}

type rawInput struct {
	inputType uint32
	_         uint32 // padding so the union starts 8-byte aligned, matching amd64 INPUT
	data      [32]byte
}

func newMouseInputRaw(mi mouseInputData) rawInput {
	var in rawInput
	in.inputType = inputMouse
	*(*mouseInputData)(unsafe.Pointer(&in.data[0])) = mi
	return in
}

func newKeybdInputRaw(ki keybdInputData) rawInput {
	var in rawInput
	in.inputType = inputKeyboard
	*(*keybdInputData)(unsafe.Pointer(&in.data[0])) = ki
	return in
}

func sendRawInputs(inputs []rawInput) {
	if len(inputs) == 0 {
		return
	}
	_, _, _ = procSendInput.Call(
		uintptr(len(inputs)),
		uintptr(unsafe.Pointer(&inputs[0])),
		unsafe.Sizeof(inputs[0]),
	)
}

func virtualScreenSize() (w, h int32) {
	wr, _, _ := procGetSysMetric.Call(uintptr(smCXVirtualScreen))
	hr, _, _ := procGetSysMetric.Call(uintptr(smCYVirtualScreen))
	return int32(wr), int32(hr)
}

// moveMouseAbsolute takes fractions of the virtual desktop (0..1) - MOUSEEVENTF_VIRTUALDESK
// makes 0,0..65535,65535 map to the whole virtual desktop regardless of monitor layout, so no
// manual per-monitor offset math is needed here.
func moveMouseAbsolute(xFrac, yFrac float64) {
	if xFrac < 0 {
		xFrac = 0
	} else if xFrac > 1 {
		xFrac = 1
	}
	if yFrac < 0 {
		yFrac = 0
	} else if yFrac > 1 {
		yFrac = 1
	}
	w, h := virtualScreenSize()
	if w <= 0 || h <= 0 {
		return
	}
	mi := mouseInputData{
		dx:      int32(xFrac * 65535),
		dy:      int32(yFrac * 65535),
		dwFlags: mouseEventFMove | mouseEventFAbsolute | mouseEventFVirtualDesk,
	}
	sendRawInputs([]rawInput{newMouseInputRaw(mi)})
}

func mouseButtonEvent(button string, down bool) {
	var flag uint32
	switch button {
	case "left":
		if down {
			flag = mouseEventFLeftDown
		} else {
			flag = mouseEventFLeftUp
		}
	case "right":
		if down {
			flag = mouseEventFRightDown
		} else {
			flag = mouseEventFRightUp
		}
	case "middle":
		if down {
			flag = mouseEventFMiddleDown
		} else {
			flag = mouseEventFMiddleUp
		}
	default:
		return
	}
	sendRawInputs([]rawInput{newMouseInputRaw(mouseInputData{dwFlags: flag})})
}

// mouseWheelEvent takes a delta in "notches" (the admin console is expected to send +/-1 per
// wheel notch, or a fraction thereof for trackpads) - WHEEL_DELTA (120) is the Win32 unit for
// one notch.
func mouseWheelEvent(deltaNotches float64) {
	mi := mouseInputData{
		mouseData: uint32(int32(deltaNotches * 120)),
		dwFlags:   mouseEventFWheel,
	}
	sendRawInputs([]rawInput{newMouseInputRaw(mi)})
}

func keyboardEvent(code string, down bool) {
	vk, ok := keyCodeToVK[code]
	if !ok {
		return
	}
	var flags uint32
	if !down {
		flags = keyEventFKeyUp
	}
	sendRawInputs([]rawInput{newKeybdInputRaw(keybdInputData{wVk: vk, dwFlags: flags})})
}

// keyCodeToVK maps a JS KeyboardEvent.code value (the layout-independent physical key
// identifier - what the future admin console's browser-side capture will send) to a Windows
// virtual-key code. Not exhaustive, but covers every key a remote-support session realistically
// needs: letters, digits, punctuation, navigation, function keys, and modifiers.
var keyCodeToVK = map[string]uint16{
	"Backspace": 0x08, "Tab": 0x09, "Enter": 0x0D,
	"ShiftLeft": 0xA0, "ShiftRight": 0xA1, "ControlLeft": 0xA2, "ControlRight": 0xA3,
	"AltLeft": 0xA4, "AltRight": 0xA5, "Pause": 0x13, "CapsLock": 0x14, "Escape": 0x1B,
	"Space": 0x20, "PageUp": 0x21, "PageDown": 0x22, "End": 0x23, "Home": 0x24,
	"ArrowLeft": 0x25, "ArrowUp": 0x26, "ArrowRight": 0x27, "ArrowDown": 0x28,
	"Insert": 0x2D, "Delete": 0x2E,
	"Digit0": 0x30, "Digit1": 0x31, "Digit2": 0x32, "Digit3": 0x33, "Digit4": 0x34,
	"Digit5": 0x35, "Digit6": 0x36, "Digit7": 0x37, "Digit8": 0x38, "Digit9": 0x39,
	"KeyA": 0x41, "KeyB": 0x42, "KeyC": 0x43, "KeyD": 0x44, "KeyE": 0x45, "KeyF": 0x46,
	"KeyG": 0x47, "KeyH": 0x48, "KeyI": 0x49, "KeyJ": 0x4A, "KeyK": 0x4B, "KeyL": 0x4C,
	"KeyM": 0x4D, "KeyN": 0x4E, "KeyO": 0x4F, "KeyP": 0x50, "KeyQ": 0x51, "KeyR": 0x52,
	"KeyS": 0x53, "KeyT": 0x54, "KeyU": 0x55, "KeyV": 0x56, "KeyW": 0x57, "KeyX": 0x58,
	"KeyY": 0x59, "KeyZ": 0x5A,
	"MetaLeft": 0x5B, "MetaRight": 0x5C,
	"F1": 0x70, "F2": 0x71, "F3": 0x72, "F4": 0x73, "F5": 0x74, "F6": 0x75,
	"F7": 0x76, "F8": 0x77, "F9": 0x78, "F10": 0x79, "F11": 0x7A, "F12": 0x7B,
	"Semicolon": 0xBA, "Equal": 0xBB, "Comma": 0xBC, "Minus": 0xBD, "Period": 0xBE,
	"Slash": 0xBF, "Backquote": 0xC0, "BracketLeft": 0xDB, "Backslash": 0xDC,
	"BracketRight": 0xDD, "Quote": 0xDE,
}

// remoteInputEvent is this feature's own DataChannel wire format - there is no existing
// contract to match since the admin console (Phase 4) doesn't exist yet. x/y are fractions of
// the virtual desktop (0..1), matching what the video track shows.
type remoteInputEvent struct {
	Type   string  `json:"type"`
	X      float64 `json:"x,omitempty"`
	Y      float64 `json:"y,omitempty"`
	Button string  `json:"button,omitempty"`
	Delta  float64 `json:"delta,omitempty"`
	Key    string  `json:"key,omitempty"`
}

// handleRemoteInput is the DataChannel message handler. permissionsGranted is the
// server-asserted, comma-separated grant string read fresh from the session poll (see
// respondToSessionRequest/sessionAuthorization.ts) - the agent enforces it independently rather
// than trusting whatever the far end of the DataChannel claims, per "do not trust permissions
// supplied by the frontend."
func handleRemoteInput(data []byte, permissionsGranted string) {
	if !hasPermission(permissionsGranted, "control") {
		return
	}
	var ev remoteInputEvent
	if err := json.Unmarshal(data, &ev); err != nil {
		return
	}
	switch ev.Type {
	case "mousemove":
		moveMouseAbsolute(ev.X, ev.Y)
	case "mousedown":
		mouseButtonEvent(ev.Button, true)
	case "mouseup":
		mouseButtonEvent(ev.Button, false)
	case "wheel":
		mouseWheelEvent(ev.Delta)
	case "keydown":
		keyboardEvent(ev.Key, true)
	case "keyup":
		keyboardEvent(ev.Key, false)
	}
}

func hasPermission(granted, want string) bool {
	for _, p := range strings.Split(granted, ",") {
		if strings.TrimSpace(p) == want {
			return true
		}
	}
	return false
}
