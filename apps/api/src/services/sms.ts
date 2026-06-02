// 阿里云「号码认证服务 → 短信认证服务」封装（v2.3 登录改造）
//
// 为什么用「短信认证服务」(DyPNSAPI) 而不是「短信服务」(DySMSAPI)：
//   - 个人开发者无企业资质：短信认证服务免申请签名/模板，平台提供系统签名+系统模板，开通即用。
//   - 验证码全生命周期由阿里云托管：生成、存库、有效期、频控、去重、校验全在云端，
//     因此本地不再需要 OTP 数据表，auth.route 只负责「发码」和「校验」两个动作。
//
// SDK：@alicloud/dypnsapi20170525 v2.x（dara 运行时）
//   - 默认导出为 Client（不是 Dypnsapi）
//   - 依赖 @alicloud/openapi-core 提供的 $OpenApiUtil.Config（不是旧的 @alicloud/openapi-client）
//   - 方法：sendSmsVerifyCode / checkSmsVerifyCode
//
// 设计与 mailer.ts 对齐：
//   - 凭证全部从环境变量读取，绝不硬编码、绝不入库
//   - 未配置凭证时降级为「内存 Map 模拟发码/校验」，方便本地联调（无需真发短信）
//   - 真正发送失败时抛错，由调用方决定是否吞掉（auth.route 发码走 fire-and-forget）
//
// 需要的环境变量（控制台拿到后填入服务器 .env）：
//   ALIYUN_SMS_ACCESS_KEY_ID      RAM 用户 AccessKey ID
//   ALIYUN_SMS_ACCESS_KEY_SECRET  RAM 用户 AccessKey Secret
//   ALIYUN_SMS_SIGN_NAME          系统签名内容（短信认证服务 → 控制台可查，形如「阿里云」）
//   ALIYUN_SMS_TEMPLATE_CODE      系统验证码模板 CODE（控制台可查，形如 SMS_xxxxxxx）

import Client, {
  SendSmsVerifyCodeRequest,
  CheckSmsVerifyCodeRequest,
} from "@alicloud/dypnsapi20170525"
import { $OpenApiUtil } from "@alicloud/openapi-core"

const ACCESS_KEY_ID = process.env.ALIYUN_SMS_ACCESS_KEY_ID
const ACCESS_KEY_SECRET = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET
const SIGN_NAME = process.env.ALIYUN_SMS_SIGN_NAME
const TEMPLATE_CODE = process.env.ALIYUN_SMS_TEMPLATE_CODE

// 凭证齐全才实例化客户端，否则保持 null → 走 MOCK 分支
const smsConfigured = Boolean(
  ACCESS_KEY_ID && ACCESS_KEY_SECRET && SIGN_NAME && TEMPLATE_CODE,
)

const client = smsConfigured
  ? new Client(
      new $OpenApiUtil.Config({
        accessKeyId: ACCESS_KEY_ID!,
        accessKeySecret: ACCESS_KEY_SECRET!,
        endpoint: "dypnsapi.aliyuncs.com",
      }),
    )
  : null

// ── MOCK 模式（本地无凭证）────────────────────────────────
// 云端托管了验证码，本地没凭证时无从校验，因此用内存 Map 自行模拟「发码→存→校验」。
// 仅用于本地联调；进程重启即清空，生产永远走真实云端分支。
const mockStore = new Map<string, { code: string; expiresAt: number }>()
const MOCK_VALID_MS = 10 * 60 * 1000

/**
 * 发送登录验证码（验证码由阿里云生成并托管）
 * @param phone 11 位国内手机号（无需 +86）
 */
export async function sendVerifyCode(phone: string): Promise<void> {
  if (!client) {
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    mockStore.set(phone, { code, expiresAt: Date.now() + MOCK_VALID_MS })
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log(`📱 [MOCK 短信] 收件人: ${phone}`)
    console.log(`🔑 验证码: ${code}（10 分钟内有效）`)
    console.log("(未配置阿里云短信认证凭证，验证码仅内存模拟、打印到控制台)")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    return
  }

  const req = new SendSmsVerifyCodeRequest({
    phoneNumber: phone,
    signName: SIGN_NAME!,
    templateCode: TEMPLATE_CODE!,
    // 模板含两个变量，必须都传，否则阿里云报 isv.INVALID_PARAMETERS「模板内容与模板参数不匹配」：
    //   ##code## —— 占位符，阿里云生成真实验证码后替换（变量名须与模板正文 ${code} 一致）
    //   min      —— 有效分钟数，须与模板正文 ${min} 一致，且与下方 validTime 对齐（600s = 10min）
    templateParam: JSON.stringify({ code: "##code##", min: "10" }),
    codeLength: 6,
    validTime: 600,
  })

  const res = await client.sendSmsVerifyCode(req)

  // body.code === "OK" 表示发送成功
  if (res.body?.code !== "OK") {
    console.error(
      "[SMS_FAIL] 阿里云验证码发送失败:",
      res.body?.code,
      res.body?.message,
    )
    throw new Error("验证码发送失败")
  }
}

/**
 * 校验登录验证码（交给阿里云比对，本地不存码）
 * @returns true=验证通过，false=错误或已过期
 */
export async function checkVerifyCode(
  phone: string,
  code: string,
): Promise<boolean> {
  if (!client) {
    const rec = mockStore.get(phone)
    if (!rec) return false
    if (Date.now() > rec.expiresAt) {
      mockStore.delete(phone)
      return false
    }
    const ok = rec.code === code
    if (ok) mockStore.delete(phone) // 一次性，校验通过即作废
    return ok
  }

  const req = new CheckSmsVerifyCodeRequest({
    phoneNumber: phone,
    verifyCode: code,
  })

  // 阿里云对「验证码错误/已过期」不是返回 verifyResult≠PASS，而是直接抛 isv.ValidateFail（HTTP 400）。
  // 必须接住并降级为 false（→ auth.route 返回 401「验证码错误或已过期」），
  // 否则异常冒泡到 /login 会被吞成裸 500，前端只看到「Request failed with status code 500」。
  // 仅对「校验失败」这一类业务错误降级；其余（网络/凭证等）仍抛出，让上层按真 500 处理。
  try {
    const res = await client.checkSmsVerifyCode(req)
    // success 仅代表请求成功，verifyResult 才代表校验结果：PASS=通过，其余=失败。
    return res.body?.model?.verifyResult === "PASS"
  } catch (err) {
    if ((err as { code?: string })?.code === "isv.ValidateFail") {
      return false
    }
    throw err
  }
}
