/**
 * 飞书配置验证脚本
 */

import axios from 'axios';

const FEISHU_APP_ID = 'cli_a937bd1eba781bb3';
const FEISHU_APP_SECRET = 'Jsz8wdNz1blnmogCoIDM9z84MPLINQtr';
const FEISHU_APP_TOKEN = 'TPPKbMXuQaHqBnsa8HFcrP8gnsf';
const FEISHU_TABLE_ID = 'tblYTDnJZuHuiBNa';

async function getTenantToken() {
  console.log('1. 获取 Tenant Access Token...');
  const url = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';

  try {
    const response = await axios.post(url, {
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET
    }, { timeout: 10000 });

    if (response.data.code === 0) {
      console.log('   ✅ Token获取成功');
      console.log(`   📝 Token: ${response.data.tenant_access_token.slice(0, 20)}...`);
      return response.data.tenant_access_token;
    } else {
      console.log(`   ❌ Token获取失败: ${response.data.msg}`);
      return null;
    }
  } catch (error: any) {
    console.log(`   ❌ 请求失败: ${error.message}`);
    return null;
  }
}

async function checkBitable(token: string) {
  console.log('\n2. 检查多维表格...');
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}`;

  try {
    const response = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log(`   📝 响应码: ${response.data.code}`);
    console.log(`   📝 响应消息: ${response.data.msg}`);

    if (response.data.code === 0) {
      console.log(`   ✅ 多维表格名称: ${response.data.data?.table?.name}`);
      return true;
    } else {
      console.log('   📝 完整响应:', JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error: any) {
    console.log(`   ❌ 请求失败: ${error.message}`);
    if (error.response) {
      console.log('   📝 错误响应:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function createTestRecord(token: string) {
  console.log('\n3. 写入测试记录...');

  // 先获取表格列表
  const tablesUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables`;

  let tableId: string;
  try {
    const tablesResponse = await axios.get(tablesUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (tablesResponse.data.code !== 0) {
      console.log(`   ❌ 获取表格列表失败: ${tablesResponse.data.msg}`);
      console.log('   📝 完整响应:', JSON.stringify(tablesResponse.data, null, 2));
      return;
    }

    const tables = tablesResponse.data.data?.items || [];
    console.log(`   📋 找到 ${tables.length} 个表格`);

    if (tables.length === 0) {
      console.log('   ❌ 多维表格中没有表格');
      return;
    }

    // 使用第一个表格，或者使用指定的 tableId
    tableId = FEISHU_TABLE_ID;
    console.log(`   📋 使用表格ID: ${tableId}`);
  } catch (error: any) {
    console.log(`   ❌ 获取表格列表请求失败: ${error.message}`);
    if (error.response) {
      console.log('   📝 错误响应:', JSON.stringify(error.response.data, null, 2));
    }
    return;
  }

  // 写入记录
  const recordUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${tableId}/records`;

  const fields = {
    '标题': 'Social Content Forge 测试记录',
    '来源类型': 'material',
    '综合评分': 85,
    '状态': '草稿'
  };

  try {
    const response = await axios.post(recordUrl, {
      fields
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log(`   📝 响应码: ${response.data.code}`);
    console.log(`   📝 响应消息: ${response.data.msg}`);

    if (response.data.code === 0) {
      console.log('   ✅ 记录写入成功!');
      console.log(`   📝 记录ID: ${response.data.data?.record?.record_id}`);
    } else {
      console.log('   📝 完整响应:', JSON.stringify(response.data, null, 2));
    }
  } catch (error: any) {
    console.log(`   ❌ 请求失败: ${error.message}`);
    if (error.response) {
      console.log('   📝 错误响应:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function main() {
  console.log('='.repeat(50));
  console.log('🔍 飞书配置验证');
  console.log('='.repeat(50));
  console.log(`📋 App Token: ${FEISHU_APP_TOKEN}`);
  console.log(`📋 Table ID: ${FEISHU_TABLE_ID}`);

  const token = await getTenantToken();
  if (!token) {
    console.log('\n❌ 无法获取 Token，请检查 APP_ID 和 APP_SECRET');
    return;
  }

  const bitableOk = await checkBitable(token);

  if (bitableOk) {
    await createTestRecord(token);
  }

  console.log('\n' + '='.repeat(50));
}

main().catch(console.error);
