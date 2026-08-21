# REPORT — v0.5 UI Pro

## Mục tiêu
Nâng cấp toàn bộ UI/UX trên nền v0.4, không thay đổi nền logic scan/multi-device và không thêm chức năng reconstruction giả.

## Thay đổi giao diện
- Visual system dark professional mới với accent xanh tím/cyan, border, depth, typography và trạng thái nhất quán.
- Header/brand mới, không có branding công ty.
- Mode cards có icon, active state, hover state; mobile chuyển thành horizontal swipe để tiết kiệm chiều cao.
- Camera workspace có LIVE/READY badge, scan corners, empty state chuyên nghiệp và guide pill.
- Scan Control panel có hierarchy rõ, quality indicator, actions/control/stats compact hơn.
- Coverage, Multi-Device, Self-Test và Pipeline dùng chung premium panel system.
- Mobile breakpoint được tinh chỉnh cho màn nhỏ 390–640 px; giữ camera là vùng ưu tiên lớn nhất.
- Service Worker cache key tăng từ v4 lên v5 để giảm nguy cơ giữ CSS cũ sau deploy.

## Logic giữ nguyên
- Camera trước/sau/USB, MediaPipe Pose/Face/Hands/Object, IndexedDB, quality score, coverage, P2P Offer/Answer, calibration, session state và Test Lab vẫn giữ nguyên.
- Không tự upload dữ liệu scan.
- Chưa giả lập point cloud/mesh/rig/reconstruction hoàn chỉnh.

## Kiểm tra
- Cấu trúc source đầy đủ.
- Đã rà JSX/CSS sau chỉnh sửa và giữ nguyên handler/state logic.
- TypeScript hệ thống hiện có: 5.8.3; package yêu cầu TypeScript 7.0.2.
- Chưa xác nhận full npm build nếu môi trường không có dependency/registry. Trên PC chạy `npm install`, `npm run lint`, `npm run build`.

# REPORT – 3D Scanner Studio v0.4 Multi-Device Foundation

## Nền source

- Dùng đúng FULL SOURCE v0.3 Scan QA làm nền.
- Không rollback source cũ.
- Không thêm branding công ty.
- Không push GitHub hoặc deploy.

## Thay đổi chính

### Multi-device thật
- Thêm `src/multidevice.ts` với WebRTC DataChannel P2P.
- Host tạo SDP Offer; Join nhận Offer và tạo Answer; Host nhận Answer.
- Không giả QR/mã phòng thành kết nối khi chưa có signaling server.
- Dùng STUN công khai để hỗ trợ ICE; kết nối thực tế vẫn phụ thuộc mạng/NAT của thiết bị.
- Đồng bộ Device Status, Scan State và coverage sector.

### Session management
- Thêm state machine: idle / calibrating / ready / scanning / paused / processing / review / export.
- Thêm session code và vai trò thiết bị Front/Back/Left/Right/Top/Auto.
- Thêm dashboard thiết bị: FPS, độ phân giải, tracking, depth capability.
- Thêm calibration theo kích thước tham chiếu mm và ghi chú marker.
- Thêm Test Lab mô phỏng 3 điện thoại để kiểm tra UI/logic nhanh trên PC.

### Storage/recovery
- IndexedDB schema tăng từ v1 lên v2 nhưng giữ store cũ, thêm `sessions` để migration không xóa frame/project hiện có.
- Frame metadata bổ sung deviceId, sessionId và camera settings.
- Project metadata nâng schema lên v4 và lưu scan state/session.
- Export JSON v4 chứa multi-device/session/camera metadata nhưng không nhúng Base64.

### Coverage
- Coverage hiển thị hợp nhất local + remote.
- Remote device có thể gửi sector khi chụp frame.
- Test Lab có shared coverage để test giao diện trước khi dùng nhiều điện thoại thật.

## Logic được kiểm tra

- Tracking không bị coi là mesh/rig.
- Multi-device state/coverage không đồng nghĩa reconstruction 3D.
- Ảnh gốc vẫn local-first; chưa truyền file lớn qua P2P để tránh memory/network failure.
- Session recovery chỉ phục hồi metadata an toàn, không tự khởi động camera sau reload.
- IndexedDB migration không xóa store `frames`/`projects` cũ.
- GitHub Pages vẫn dùng `base: './'`.
- Workflow không tự deploy ngoài GitHub Pages khi user push lên main.

## Chưa hoàn thành / không khai báo giả

- QR signaling tự động.
- Chunked P2P frame transfer + retry/resume.
- Camera synchronization chính xác cấp frame/timecode giữa nhiều máy.
- Camera intrinsics calibration chuyên sâu.
- SLAM/VIO/camera pose.
- Depth fusion / LiDAR native.
- Point cloud / mesh reconstruction.
- Retopology / rig / skin / animation export thật.

## Kiểm tra trước giao

- TypeScript syntax transpile: PASS cho `main.tsx`, `storage.ts`, `multidevice.ts`, `vision.ts`, `vite.config.ts`.
- Type-check độc lập `storage.ts` + `multidevice.ts`: PASS bằng TypeScript compiler có sẵn.
- `npm install`: TIMEOUT do npm registry trong môi trường hiện tại, vì vậy chưa có `node_modules`/`package-lock.json`.
- Full `npm run lint` + `npm run build`: chưa thể xác nhận do dependency chưa tải được; không báo PASS giả.
- package.json: version 0.4.0, dependency version vẫn khóa cố định.
- PWA cache đã tăng `scanner-shell-v4` để tránh giữ shell v0.3.
- Secret scan: không thấy token/API key/private key theo các pattern phổ biến.
- ZIP integrity: kiểm tra sau khi đóng gói bằng `unzip -t`.
