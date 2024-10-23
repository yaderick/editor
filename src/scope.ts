/**
 * 位掩码的使用:
    高效性：位掩码允许用单个数值表示多个布尔状态，这样可以有效节省存储空间和处理时间。
    组合特性：通过位与（&）、位或（|）和位非（~）运算，可以灵活地组合和检查不同的权限或特性。
    每一位都代表不同权限或者状态，赋予权限使用 | ,检验权限使用 &
    view 为0011， editor为1100 如果一个key为 1011 代表什么？
    key & view = 1011 & 0011 = 0011 (表示具有完全的view 权限)
    key & editor = 1011 & 1100 = 1000 (表示具有 某种 编辑权限)
 * */ 
enum Scope {
  // 基础掩码
  TYPE = (1 << 2) - 1, // 1左移2位 从1-> 100 代表十进制的 4；结果4-1= 数字 3
  LEVEL = ((1 << 2) - 1) << 2, // 1-> 100 => (3<<2)->11->1100 =  数字12
  // 组合掩码
  ATTRIBUTE = (1 << 0) | LEVEL, // 1101
  BLOT = (1 << 1) | LEVEL, // 1110
  INLINE = (1 << 2) | TYPE, // 0111
  BLOCK = (1 << 3) | TYPE, // 1011
  // 掩码交集
  BLOCK_BLOT = BLOCK & BLOT, // 1010
  INLINE_BLOT = INLINE & BLOT, // 0110
  BLOCK_ATTRIBUTE = BLOCK & ATTRIBUTE, // 1001
  INLINE_ATTRIBUTE = INLINE & ATTRIBUTE, // 0101

  ANY = TYPE | LEVEL,
}

enum Scopes {
  TYPE = (1 << 2) - 1, // 3 (二进制: 0011)
  LEVEL = ((1 << 2) - 1) << 2, // 12 (二进制: 1100)
  ANY = TYPE | LEVEL, // 15 (二进制: 1111)


  ATTRIBUTE = (1 << 0) | LEVEL, // 13 (二进制: 1101)
  BLOT = (1 << 1) | LEVEL, // 14 (二进制: 1110)

  INLINE = (1 << 2) | TYPE, // 7 (二进制: 0111)
  BLOCK = (1 << 3) | TYPE, // 11 (二进制: 1011)

  BLOCK_BLOT = BLOCK & BLOT, // 10 (二进制: 1010)
  INLINE_BLOT = INLINE & BLOT, // 6 (二进制: 0110)
  BLOCK_ATTRIBUTE = BLOCK & ATTRIBUTE, // 9 (二进制: 1001)
  INLINE_ATTRIBUTE = INLINE & ATTRIBUTE, // 5 (二进制: 0101)

}
/**
 * 在实际开发中，位掩码（bitmask）常用于权限管理、状态标识、配置选项等场景。以下是一些实际开发中的例子：
 * 权限管理
 * const Permissions = {
    VIEW: 1 << 0,  // 0001
    EDIT: 1 << 1,  // 0010
    DELETE: 1 << 2 // 0100
  };

// 例：给用户A配置查看和编辑权限
const userPermissions = Permissions.VIEW | Permissions.EDIT; // 0011

// 检查用户A有没有删除权限
const canEdit = (userPermissions & Permissions.DELETE) !== 0; // false

*/

/* 状态管理
  const States = {
    IDLE: 1 << 0,      // 0001
    WALKING: 1 << 1,   // 0010
    RUNNING: 1 << 2,   // 0100
    JUMPING: 1 << 3    // 1000
  };

  // 角色当前状态
  let characterState = States.WALKING | States.JUMPING; // 0011

  // 检查状态
  const isJumping = (characterState & States.JUMPING) !== 0; // true

**/

/**
 * 配置选项
 * const ConfigOptions = {
  LOGGING: 1 << 0,     // 0001
  DEBUG_MODE: 1 << 1,  // 0010
  USE_CACHE: 1 << 2    // 0100
};

// 应用配置
let appConfig = ConfigOptions.LOGGING | ConfigOptions.USE_CACHE; // 0101

// 检查配置
const isDebugMode = (appConfig & ConfigOptions.DEBUG_MODE) !== 0; // false

*/

export default Scope;
