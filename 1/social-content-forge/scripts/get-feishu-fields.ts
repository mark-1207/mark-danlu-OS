/**
 * 获取飞书多维表格字段信息
 */

import axios from 'axios';

const FEISHU_APP_ID = 'cli_a937bd1eba781bb3';
const FEISHU_APP_SECRET = 'Jsz8wdNz1blnmogCoIDM9z84MPLINQtr';
const FEISHU_APP_TOKEN = 'TPPKbMXuQaHqBnsa8HFcrP8gnsf';
const FEISHU_TABLE_ID = 'tblYTDnJZuHuiBNa';

async function getTenantToken() {
  const url = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';
  const response = await axios.post(url, {
    app_id: FEISHU_APP_ID,
    app_secret: FEISHU_APP_SECRET
  }, { timeout: 10000 });
  return response.data.tenant_access_token;
}

async function main() {
  console.log('获取飞书多维表格字段信息...\n');

  const token = await getTenantToken();

  // 获取表格信息
  const tablesUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables`;
  const tablesResponse = await axios.get(tablesUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  console.log('表格列表:', JSON.stringify(tablesResponse.data, null, 2));

  // 获取字段列表
  const fieldsUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_APP_TOKEN}/tables/${FEISHU_TABLE_ID}/fields`;
  const fieldsResponse = await axios.get(fieldsUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  console.log('\n字段列表:');
  const fields = fieldsResponse.data.data?.items || [];
  fields.forEach((f: any) => {
    console.log(`  - ${f.field_name} (type: ${f.type}, id: ${f.field_id})`);
  });
}

main().catch(console.error);
