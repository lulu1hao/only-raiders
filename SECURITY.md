# 安全策略与更新签名校验 (Security Policy)

## 1. 在线更新数字签名机制

自签名加固版本起，Only Raiders 客户端内置固定的 **Ed25519 验证公钥**，对全部远程更新和本地热更新执行强制密码学校验：

- **更新清单验签**：`update-manifest.json` 与 `update-manifest.json.sig` 必须配对并通过 Ed25519 校验（域分离前缀 `only-raiders:update-manifest:v1`）。
- **外部资源清单验签**：`assets-manifest.json` 与 `assets-manifest.json.sig` 必须配对并通过 Ed25519 校验（域分离前缀 `only-raiders:assets-manifest:v1`），离线缓存读取时同样重新验签。
- **热更新包逐文件完整性保护**：`web-bundle-*.tar.gz` 内含经 Ed25519 签名的 `web-files.json` 与 `web-files.json.sig`（域分离前缀 `only-raiders:web-files:v1`）。客户端在激活前、每次启动时及运行时读取前均校验 SHA-256，检测到任意本地篡改立即自动回滚至程序内置只读资源。
- **防降级与源锁定**：客户端仅接受来自 `https://github.com/lulu1hao/only-raiders/releases/` 的已签名更新，拒绝无签名或缺少 64 位 SHA-256 的更新响应，拒绝跨非白名单域名重定向及版本回滚。

### 官方内置 Ed25519 公钥

```text
Algorithm : Ed25519 (RFC 8032, raw 32-byte public key)
Base64    : xisuHJSAZpBGh172X6hwo0kDVBRT6/98Yj2HsVCRCCo=
Hex       : c62b2e1c9480669046875ef65fa870a34903541453ebff7c623d87b15091082a
SHA-256 FP: 3409b1068040ea1e
```

## 2. 安全漏洞反馈

如果您发现了安全漏洞、更新链路隐患或恶意假冒包，请勿在公开 Issue 中披露可被直接利用的细节，请通过 GitHub Security Advisories 或 [README.md](./README.md) 中的联系方式私下告知维护者。
