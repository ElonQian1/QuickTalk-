use anyhow::Result;

/// 尝试将传入的店铺引用（数值ID或API Key）解析为实际 shop_id。
/// 返回 Ok(Some(id)) 表示解析成功，Ok(None) 表示找不到匹配；Err 表示查询过程出错。
pub async fn resolve_shop_id(db: &sea_orm::DatabaseConnection, shop_ref: &str) -> Result<Option<i64>> {
    if let Ok(id) = shop_ref.parse::<i64>() {
        return Ok(Some(id));
    }
    match crate::repositories::ShopRepository::find_by_api_key(db, shop_ref).await? {
        Some(shop) => Ok(Some(shop.id as i64)),
        None => Ok(None),
    }
}
