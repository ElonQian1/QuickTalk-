//! Shop Repository - 店铺数据访问层
//! 
//! 职责：
//! - 店铺的创建、查询、更新、删除
//! - 店铺员工关联查询

use anyhow::Result;
use sea_orm::*;
use crate::entities::{shops, shop_staffs, prelude::*};

pub struct ShopRepository;

impl ShopRepository {
    /// 根据 ID 查找店铺
    pub async fn find_by_id(db: &DatabaseConnection, id: i32) -> Result<Option<shops::Model>> {
        let shop = Shops::find_by_id(id).one(db).await?;
        Ok(shop)
    }
    
    /// 根据 slug 查找店铺
    pub async fn find_by_slug(db: &DatabaseConnection, slug: &str) -> Result<Option<shops::Model>> {
        let shop = Shops::find()
            .filter(shops::Column::Slug.eq(slug))
            .one(db)
            .await?;
        Ok(shop)
    }
    
    /// 创建新店铺
    pub async fn create(
        db: &DatabaseConnection,
        name: String,
        slug: String,
        description: Option<String>,
        owner_id: i32, // 改为必需的i32
    ) -> Result<shops::Model> {
        let shop = shops::ActiveModel {
            name: Set(name),
            slug: Set(slug),
            description: Set(description),
            owner_id: Set(Some(owner_id)),
            is_active: Set(true),
            created_at: Set(chrono::Utc::now().naive_utc()),
            updated_at: Set(chrono::Utc::now().naive_utc()),
            ..Default::default()
        };
        
        let result = shop.insert(db).await?;
        Ok(result)
    }
    
    /// 获取用户拥有的店铺（作为所有者）
    pub async fn find_by_owner(db: &DatabaseConnection, owner_id: i32) -> Result<Vec<shops::Model>> {
        let shops = Shops::find()
            .filter(shops::Column::OwnerId.eq(owner_id))
            .filter(shops::Column::IsActive.eq(true))
            .order_by_asc(shops::Column::Name)
            .all(db)
            .await?;
        Ok(shops)
    }
    
    /// 获取用户作为员工的店铺列表
    pub async fn find_by_staff(db: &DatabaseConnection, user_id: i32) -> Result<Vec<shops::Model>> {
        // 通过shop_staffs表查询用户作为员工的店铺
        use crate::entities::{shop_staffs, shops};
        use sea_orm::*;
        
        let shops = Shops::find()
            .join(
                JoinType::InnerJoin,
                shops::Relation::ShopStaffs.def(),
            )
            .filter(shop_staffs::Column::UserId.eq(user_id))
            .filter(shops::Column::IsActive.eq(true))
            .order_by_asc(shops::Column::Name)
            .all(db)
            .await?;
        Ok(shops)
    }
    
    /// 获取用户可访问的所有店铺（所有者 + 员工）
    pub async fn find_accessible_by_user(db: &DatabaseConnection, user_id: i32) -> Result<Vec<shops::Model>> {
        // 方式1：用户是所有者的店铺
        let owned_shops = Shops::find()
            .filter(shops::Column::OwnerId.eq(user_id))
            .filter(shops::Column::IsActive.eq(true))
            .all(db)
            .await?;
        
        // 方式2：用户是员工的店铺
        let staff_shop_ids: Vec<i32> = ShopStaffs::find()
            .filter(shop_staffs::Column::UserId.eq(user_id))
            .filter(shop_staffs::Column::IsActive.eq(true))
            .all(db)
            .await?
            .into_iter()
            .map(|s| s.shop_id)
            .collect();
        
        let staff_shops = if !staff_shop_ids.is_empty() {
            Shops::find()
                .filter(shops::Column::Id.is_in(staff_shop_ids))
                .filter(shops::Column::IsActive.eq(true))
                .all(db)
                .await?
        } else {
            vec![]
        };
        
        // 合并并去重
        let mut all_shops = owned_shops;
        for shop in staff_shops {
            if !all_shops.iter().any(|s| s.id == shop.id) {
                all_shops.push(shop);
            }
        }
        
        // 按名称排序
        all_shops.sort_by(|a, b| a.name.cmp(&b.name));
        
        Ok(all_shops)
    }
    
    /// 更新店铺信息
    pub async fn update(
        db: &DatabaseConnection,
        shop_id: i32,
        name: Option<String>,
        description: Option<String>,
        logo_url: Option<String>,
        website_url: Option<String>,
        contact_email: Option<String>,
        contact_phone: Option<String>,
    ) -> Result<shops::Model> {
        let mut shop: shops::ActiveModel = Shops::find_by_id(shop_id)
            .one(db)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Shop not found"))?
            .into();
        
        if let Some(n) = name {
            shop.name = Set(n);
        }
        if let Some(d) = description {
            shop.description = Set(Some(d));
        }
        if let Some(l) = logo_url {
            shop.logo_url = Set(Some(l));
        }
        if let Some(w) = website_url {
            shop.website_url = Set(Some(w));
        }
        if let Some(e) = contact_email {
            shop.contact_email = Set(Some(e));
        }
        if let Some(p) = contact_phone {
            shop.contact_phone = Set(Some(p));
        }
        shop.updated_at = Set(chrono::Utc::now().naive_utc());
        
        let result = shop.update(db).await?;
        Ok(result)
    }
    
    /// 删除店铺（软删除：设置为不活跃）
    pub async fn soft_delete(db: &DatabaseConnection, shop_id: i32) -> Result<()> {
        let mut shop: shops::ActiveModel = Shops::find_by_id(shop_id)
            .one(db)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Shop not found"))?
            .into();
        
        shop.is_active = Set(false);
        shop.updated_at = Set(chrono::Utc::now().naive_utc());
        shop.update(db).await?;
        
        Ok(())
    }
    
    /// 列出所有活跃店铺
    pub async fn list_active(db: &DatabaseConnection) -> Result<Vec<shops::Model>> {
        let shops = Shops::find()
            .filter(shops::Column::IsActive.eq(true))
            .order_by_asc(shops::Column::Name)
            .all(db)
            .await?;
        Ok(shops)
    }
    
    /// 检查 slug 是否存在
    pub async fn slug_exists(db: &DatabaseConnection, slug: &str) -> Result<bool> {
        let count = Shops::find()
            .filter(shops::Column::Slug.eq(slug))
            .count(db)
            .await?;
        Ok(count > 0)
    }
    
    /// 根据 API Key 查找店铺
    /// 
    /// 对应 database.rs 中的 get_shop_by_api_key 方法
    /// 注意：需要在 shops 实体中添加 api_key 字段
    pub async fn find_by_api_key(db: &DatabaseConnection, api_key: &str) -> Result<Option<shops::Model>> {
        let shop = Shops::find()
            .filter(shops::Column::ApiKey.eq(api_key))
            .one(db)
            .await?;
        Ok(shop)
    }
    
    /// 检查用户是否拥有指定店铺
    pub async fn is_owner(db: &DatabaseConnection, shop_id: i32, user_id: i32) -> Result<bool> {
        let shop = Shops::find_by_id(shop_id)
            .one(db)
            .await?;
        
        match shop {
            Some(s) => {
                match s.owner_id {
                    Some(owner_id) => Ok(owner_id == user_id),
                    None => Ok(false),
                }
            },
            None => Ok(false),
        }
    }
    
    /// 生成唯一的 API Key
    pub fn generate_api_key() -> String {
        uuid::Uuid::new_v4().to_string()
    }
    
    /// 重新生成店铺的 API Key
    pub async fn regenerate_api_key(db: &DatabaseConnection, shop_id: i32) -> Result<String> {
        let mut shop: shops::ActiveModel = Shops::find_by_id(shop_id)
            .one(db)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Shop not found"))?
            .into();
        
        let new_api_key = Self::generate_api_key();
        shop.api_key = Set(new_api_key.clone()); // 移除Some包装
        shop.updated_at = Set(chrono::Utc::now().naive_utc());
        shop.update(db).await?;
        
        Ok(new_api_key)
    }
}
