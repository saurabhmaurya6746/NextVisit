BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> f991260e8b93

CREATE TABLE business_types (
    name VARCHAR(100) NOT NULL, 
    id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (name)
);

CREATE TABLE businesses (
    business_type_id UUID NOT NULL, 
    name VARCHAR(150) NOT NULL, 
    owner_name VARCHAR(150) NOT NULL, 
    email VARCHAR(150) NOT NULL, 
    phone VARCHAR(20) NOT NULL, 
    country VARCHAR(100) NOT NULL, 
    currency VARCHAR(20) NOT NULL, 
    timezone VARCHAR(100) NOT NULL, 
    address VARCHAR(500) NOT NULL, 
    logo_url VARCHAR(500), 
    trial_start TIMESTAMP WITH TIME ZONE, 
    trial_end TIMESTAMP WITH TIME ZONE, 
    subscription_status VARCHAR(30) NOT NULL, 
    is_active BOOLEAN NOT NULL, 
    is_deleted BOOLEAN NOT NULL, 
    id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_type_id) REFERENCES business_types (id), 
    UNIQUE (email)
);

CREATE TABLE users (
    business_id UUID NOT NULL, 
    name VARCHAR(150) NOT NULL, 
    email VARCHAR(150) NOT NULL, 
    hashed_password VARCHAR(255) NOT NULL, 
    role VARCHAR(50) NOT NULL, 
    is_active BOOLEAN NOT NULL, 
    id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id), 
    UNIQUE (email)
);

INSERT INTO alembic_version (version_num) VALUES ('f991260e8b93') RETURNING alembic_version.version_num;

-- Running upgrade f991260e8b93 -> e3e3ddaf0bea

CREATE TABLE customers (
    business_id UUID NOT NULL, 
    name VARCHAR(150) NOT NULL, 
    phone VARCHAR(20) NOT NULL, 
    email VARCHAR(150), 
    gender VARCHAR(20), 
    birth_date DATE, 
    anniversary_date DATE, 
    address VARCHAR(500), 
    notes VARCHAR(1000), 
    visit_count INTEGER NOT NULL, 
    total_spent FLOAT NOT NULL, 
    first_visit_at TIMESTAMP WITH TIME ZONE, 
    last_visit_at TIMESTAMP WITH TIME ZONE, 
    is_active BOOLEAN NOT NULL, 
    id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id), 
    CONSTRAINT uq_business_customer_phone UNIQUE (business_id, phone)
);

UPDATE alembic_version SET version_num='e3e3ddaf0bea' WHERE alembic_version.version_num = 'f991260e8b93';

-- Running upgrade e3e3ddaf0bea -> 84aed3ea3c42

CREATE TABLE services (
    business_id UUID NOT NULL, 
    name VARCHAR(150) NOT NULL, 
    description VARCHAR(1000), 
    price FLOAT NOT NULL, 
    duration_minutes INTEGER NOT NULL, 
    category VARCHAR(100), 
    is_active BOOLEAN NOT NULL, 
    id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id), 
    CONSTRAINT uq_business_service_name UNIQUE (business_id, name)
);

UPDATE alembic_version SET version_num='84aed3ea3c42' WHERE alembic_version.version_num = 'e3e3ddaf0bea';

-- Running upgrade 84aed3ea3c42 -> 533b69e4c49a

CREATE TABLE visits (
    business_id UUID NOT NULL, 
    customer_id UUID NOT NULL, 
    staff_id UUID, 
    status VARCHAR(9) NOT NULL, 
    notes VARCHAR(1000), 
    subtotal FLOAT NOT NULL, 
    discount FLOAT NOT NULL, 
    total_amount FLOAT NOT NULL, 
    payment_method VARCHAR(6), 
    payment_status VARCHAR(7) NOT NULL, 
    started_at TIMESTAMP WITH TIME ZONE, 
    completed_at TIMESTAMP WITH TIME ZONE, 
    id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id), 
    FOREIGN KEY(customer_id) REFERENCES customers (id), 
    FOREIGN KEY(staff_id) REFERENCES users (id)
);

UPDATE alembic_version SET version_num='533b69e4c49a' WHERE alembic_version.version_num = '84aed3ea3c42';

-- Running upgrade 533b69e4c49a -> e32414ebff01

CREATE TABLE visit_services (
    visit_id UUID NOT NULL, 
    service_id UUID NOT NULL, 
    quantity INTEGER NOT NULL, 
    unit_price FLOAT NOT NULL, 
    total_price FLOAT NOT NULL, 
    id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(service_id) REFERENCES services (id), 
    FOREIGN KEY(visit_id) REFERENCES visits (id)
);

UPDATE alembic_version SET version_num='e32414ebff01' WHERE alembic_version.version_num = '533b69e4c49a';

-- Running upgrade e32414ebff01 -> fb3e04d0aee3

CREATE TABLE loyalty_settings (
    business_id UUID NOT NULL, 
    points_per_amount FLOAT NOT NULL, 
    amount_required FLOAT NOT NULL, 
    redeem_rate FLOAT NOT NULL, 
    minimum_redeem_points INTEGER NOT NULL, 
    is_active BOOLEAN NOT NULL, 
    id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id), 
    UNIQUE (business_id)
);

CREATE TABLE customer_loyalty (
    customer_id UUID NOT NULL, 
    current_points INTEGER NOT NULL, 
    lifetime_points INTEGER NOT NULL, 
    redeemed_points INTEGER NOT NULL, 
    id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(customer_id) REFERENCES customers (id), 
    UNIQUE (customer_id)
);

UPDATE alembic_version SET version_num='fb3e04d0aee3' WHERE alembic_version.version_num = 'e32414ebff01';

-- Running upgrade fb3e04d0aee3 -> cde64e621d13

CREATE TABLE campaigns (
    business_id UUID NOT NULL, 
    name VARCHAR(150) NOT NULL, 
    campaign_type VARCHAR(11) NOT NULL, 
    target_segment VARCHAR(17) NOT NULL, 
    title VARCHAR(200) NOT NULL, 
    message VARCHAR(2000) NOT NULL, 
    is_active BOOLEAN NOT NULL, 
    id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id)
);

CREATE TABLE campaign_logs (
    campaign_id UUID NOT NULL, 
    customer_id UUID NOT NULL, 
    status VARCHAR(7) NOT NULL, 
    scheduled_for TIMESTAMP WITH TIME ZONE, 
    sent_at TIMESTAMP WITH TIME ZONE, 
    failure_reason VARCHAR(1000), 
    id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(campaign_id) REFERENCES campaigns (id), 
    FOREIGN KEY(customer_id) REFERENCES customers (id)
);

CREATE TABLE festivals (
    id UUID NOT NULL, 
    business_id UUID, 
    festival_name VARCHAR(150) NOT NULL, 
    festival_date DATE NOT NULL, 
    festival_type VARCHAR(50) DEFAULT 'cultural' NOT NULL, 
    country VARCHAR(100) DEFAULT 'India' NOT NULL, 
    state VARCHAR(100), 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id)
);

CREATE TABLE festival_campaigns (
    id UUID NOT NULL, 
    business_id UUID NOT NULL, 
    festival_id UUID NOT NULL, 
    title VARCHAR(200), 
    description TEXT, 
    discount_percent VARCHAR(50), 
    image_url TEXT, 
    start_date DATE, 
    end_date DATE, 
    coupon_code VARCHAR(50), 
    coupon_id UUID, 
    language VARCHAR(30) DEFAULT 'Hinglish' NOT NULL, 
    tone VARCHAR(40) DEFAULT 'Festive' NOT NULL, 
    message TEXT, 
    ai_generated BOOLEAN DEFAULT false NOT NULL, 
    last_generated TIMESTAMP WITH TIME ZONE, 
    last_sent TIMESTAMP WITH TIME ZONE, 
    enabled BOOLEAN DEFAULT true NOT NULL, 
    is_deleted BOOLEAN DEFAULT false NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id), 
    FOREIGN KEY(festival_id) REFERENCES festivals (id)
);

UPDATE alembic_version SET version_num='cde64e621d13' WHERE alembic_version.version_num = 'fb3e04d0aee3';

-- Running upgrade cde64e621d13 -> f071b9b01781

CREATE TABLE automation_rules (
    business_id UUID NOT NULL, 
    campaign_type VARCHAR(11) NOT NULL, 
    is_enabled BOOLEAN NOT NULL, 
    schedule_type VARCHAR(7) NOT NULL, 
    run_time VARCHAR(10), 
    last_run_at TIMESTAMP WITH TIME ZONE, 
    id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id), 
    CONSTRAINT uq_business_campaign_type_automation UNIQUE (business_id, campaign_type)
);

UPDATE alembic_version SET version_num='f071b9b01781' WHERE alembic_version.version_num = 'cde64e621d13';

-- Running upgrade f071b9b01781 -> 17a3803341fa

CREATE TABLE message_templates (
    business_id UUID NOT NULL, 
    campaign_type VARCHAR(11) NOT NULL, 
    template_name VARCHAR(150) NOT NULL, 
    message VARCHAR(2000) NOT NULL, 
    is_default BOOLEAN NOT NULL, 
    id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id), 
    CONSTRAINT uq_business_campaign_type_template UNIQUE (business_id, campaign_type)
);

UPDATE alembic_version SET version_num='17a3803341fa' WHERE alembic_version.version_num = 'f071b9b01781';

-- Running upgrade 17a3803341fa -> 7cc6d4823ec2

CREATE TABLE business_settings (
    business_id UUID NOT NULL, 
    currency VARCHAR(10) NOT NULL, 
    timezone VARCHAR(50) NOT NULL, 
    language VARCHAR(10) NOT NULL, 
    tax_percentage FLOAT NOT NULL, 
    service_charge FLOAT NOT NULL, 
    payment_qr_image VARCHAR(500), 
    payment_upi_id VARCHAR(100), 
    default_discount FLOAT NOT NULL, 
    review_link VARCHAR(500), 
    booking_link VARCHAR(500), 
    logo VARCHAR(500), 
    cover_image VARCHAR(500), 
    id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id), 
    UNIQUE (business_id)
);

UPDATE alembic_version SET version_num='7cc6d4823ec2' WHERE alembic_version.version_num = '17a3803341fa';

-- Running upgrade 7cc6d4823ec2 -> fa1eb01c537f

CREATE TABLE admins (
    id UUID NOT NULL, 
    name VARCHAR(150) NOT NULL, 
    email VARCHAR(150) NOT NULL, 
    hashed_password VARCHAR(255) NOT NULL, 
    role VARCHAR(50) DEFAULT 'SUPER_ADMIN' NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (email)
);

ALTER TABLE businesses ADD COLUMN status VARCHAR(30) DEFAULT 'PENDING' NOT NULL;

ALTER TABLE businesses ADD COLUMN rejection_reason VARCHAR(500);

ALTER TABLE businesses ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;

UPDATE alembic_version SET version_num='fa1eb01c537f' WHERE alembic_version.version_num = '7cc6d4823ec2';

-- Running upgrade fa1eb01c537f -> fcfe25b99152

ALTER TABLE businesses ADD COLUMN subscription_plan_id UUID;

ALTER TABLE businesses ADD COLUMN plan_expires_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE businesses ADD COLUMN subscription_notes VARCHAR(500);

ALTER TABLE businesses ADD FOREIGN KEY(subscription_plan_id) REFERENCES subscription_plans (id);

UPDATE alembic_version SET version_num='fcfe25b99152' WHERE alembic_version.version_num = 'fa1eb01c537f';

-- Running upgrade fcfe25b99152 -> c68c94683c98

CREATE TABLE user_sessions (
    id UUID NOT NULL, 
    user_id UUID NOT NULL, 
    business_id UUID NOT NULL, 
    device_id VARCHAR(255) NOT NULL, 
    device_name VARCHAR(255), 
    device_type VARCHAR(100), 
    platform VARCHAR(100), 
    ip_address VARCHAR(100), 
    user_agent VARCHAR(500), 
    jwt_id VARCHAR(255), 
    login_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    last_seen TIMESTAMP WITH TIME ZONE NOT NULL, 
    logout_at TIMESTAMP WITH TIME ZONE, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    FOREIGN KEY(business_id) REFERENCES businesses (id) ON DELETE CASCADE
);

UPDATE alembic_version SET version_num='c68c94683c98' WHERE alembic_version.version_num = 'fcfe25b99152';

-- Running upgrade c68c94683c98 -> 146c8455eae0

ALTER TABLE subscription_plans ADD COLUMN max_active_devices INTEGER DEFAULT '5' NOT NULL;

UPDATE alembic_version SET version_num='146c8455eae0' WHERE alembic_version.version_num = 'c68c94683c98';

-- Running upgrade 146c8455eae0 -> 796cdfbbf93f

CREATE TABLE dining_areas (
    id UUID NOT NULL, 
    business_id UUID NOT NULL, 
    name VARCHAR(100) NOT NULL, 
    display_order INTEGER DEFAULT '0' NOT NULL, 
    color VARCHAR(50), 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id) ON DELETE CASCADE
);

CREATE TABLE restaurant_tables (
    id UUID NOT NULL, 
    business_id UUID NOT NULL, 
    dining_area_id UUID NOT NULL, 
    table_name VARCHAR(100) NOT NULL, 
    capacity INTEGER DEFAULT '4' NOT NULL, 
    display_order INTEGER DEFAULT '0' NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id) ON DELETE CASCADE, 
    FOREIGN KEY(dining_area_id) REFERENCES dining_areas (id) ON DELETE CASCADE
);

CREATE TABLE salon_service_areas (
    id UUID NOT NULL, 
    business_id UUID NOT NULL, 
    name VARCHAR(100) NOT NULL, 
    display_order INTEGER DEFAULT '0' NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id) ON DELETE CASCADE
);

CREATE TABLE salon_chairs (
    id UUID NOT NULL, 
    business_id UUID NOT NULL, 
    service_area_id UUID NOT NULL, 
    chair_name VARCHAR(100) NOT NULL, 
    chair_number VARCHAR(50), 
    workstation_type VARCHAR(50) DEFAULT 'Chair' NOT NULL, 
    status VARCHAR(30) DEFAULT 'Available' NOT NULL, 
    display_order INTEGER DEFAULT '0' NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id) ON DELETE CASCADE, 
    FOREIGN KEY(service_area_id) REFERENCES salon_service_areas (id) ON DELETE CASCADE
);

CREATE TABLE salon_service_categories (
    id UUID NOT NULL, 
    business_id UUID NOT NULL, 
    name VARCHAR(100) NOT NULL, 
    display_order INTEGER DEFAULT '0' NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id) ON DELETE CASCADE
);

UPDATE alembic_version SET version_num='796cdfbbf93f' WHERE alembic_version.version_num = '146c8455eae0';

-- Running upgrade 796cdfbbf93f -> 117c32560f5b

CREATE TABLE orders (
    id UUID NOT NULL, 
    business_id UUID NOT NULL, 
    table_id UUID NOT NULL, 
    customer_id UUID, 
    order_number VARCHAR(50) NOT NULL, 
    order_source VARCHAR(3) DEFAULT 'POS' NOT NULL, 
    status VARCHAR(9) DEFAULT 'OPEN' NOT NULL, 
    subtotal FLOAT DEFAULT '0.0' NOT NULL, 
    tax_amount FLOAT DEFAULT '0.0' NOT NULL, 
    discount_amount FLOAT DEFAULT '0.0' NOT NULL, 
    total_amount FLOAT DEFAULT '0.0' NOT NULL, 
    notes VARCHAR(1000), 
    created_by UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT uq_business_order_number UNIQUE (business_id, order_number), 
    FOREIGN KEY(business_id) REFERENCES businesses (id) ON DELETE CASCADE, 
    FOREIGN KEY(table_id) REFERENCES restaurant_tables (id) ON DELETE CASCADE, 
    FOREIGN KEY(customer_id) REFERENCES customers (id) ON DELETE SET NULL, 
    FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE order_items (
    id UUID NOT NULL, 
    order_id UUID NOT NULL, 
    item_name VARCHAR(150) NOT NULL, 
    unit_price FLOAT NOT NULL, 
    quantity INTEGER DEFAULT '1' NOT NULL, 
    subtotal FLOAT NOT NULL, 
    notes VARCHAR(255), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(order_id) REFERENCES orders (id) ON DELETE CASCADE
);

UPDATE alembic_version SET version_num='117c32560f5b' WHERE alembic_version.version_num = '796cdfbbf93f';

-- Running upgrade 117c32560f5b -> 1b11f15eefe1

ALTER TABLE order_items ADD COLUMN menu_item_id UUID;

ALTER TABLE order_items ADD COLUMN tax_rate FLOAT NOT NULL;

ALTER TABLE order_items ADD COLUMN discount FLOAT NOT NULL;

ALTER TABLE order_items ADD FOREIGN KEY(menu_item_id) REFERENCES services (id) ON DELETE SET NULL;

UPDATE alembic_version SET version_num='1b11f15eefe1' WHERE alembic_version.version_num = '117c32560f5b';

-- Running upgrade 1b11f15eefe1 -> 0b1fe2e97458

CREATE TABLE menu_categories (
    id UUID NOT NULL, 
    business_id UUID NOT NULL, 
    name VARCHAR(100) NOT NULL, 
    display_order INTEGER DEFAULT '0' NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id) ON DELETE CASCADE
);

CREATE TABLE menu_items (
    id UUID NOT NULL, 
    category_id UUID NOT NULL, 
    business_id UUID NOT NULL, 
    name VARCHAR(150) NOT NULL, 
    description VARCHAR(500), 
    price FLOAT NOT NULL, 
    gst_percentage FLOAT DEFAULT '0.0' NOT NULL, 
    is_veg BOOLEAN DEFAULT true NOT NULL, 
    is_available BOOLEAN DEFAULT true NOT NULL, 
    display_order INTEGER DEFAULT '0' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(category_id) REFERENCES menu_categories (id) ON DELETE CASCADE, 
    FOREIGN KEY(business_id) REFERENCES businesses (id) ON DELETE CASCADE
);

UPDATE alembic_version SET version_num='0b1fe2e97458' WHERE alembic_version.version_num = '1b11f15eefe1';

-- Running upgrade 0b1fe2e97458 -> ae8170d84ae6

ALTER TABLE orders ADD COLUMN visit_token VARCHAR(100);

CREATE INDEX ix_orders_visit_token ON orders (visit_token);

UPDATE alembic_version SET version_num='ae8170d84ae6' WHERE alembic_version.version_num = '0b1fe2e97458';

-- Running upgrade ae8170d84ae6 -> c98170d84ae7

ALTER TABLE orders ADD COLUMN last_activity_at TIMESTAMP WITH TIME ZONE;

UPDATE alembic_version SET version_num='c98170d84ae7' WHERE alembic_version.version_num = 'ae8170d84ae6';

-- Running upgrade c98170d84ae7 -> f383f7b9c37d

ALTER TABLE business_settings ADD COLUMN recovery_enabled BOOLEAN DEFAULT true NOT NULL;

ALTER TABLE business_settings ADD COLUMN recovery_buckets VARCHAR(50) DEFAULT '15,30,45,60,90' NOT NULL;

ALTER TABLE business_settings ADD COLUMN recovery_cooldown_days INTEGER DEFAULT 7 NOT NULL;

ALTER TABLE business_settings ADD COLUMN recovery_max_messages_per_day INTEGER DEFAULT 100 NOT NULL;

ALTER TABLE business_settings ADD COLUMN recovery_window_days INTEGER DEFAULT 30 NOT NULL;

CREATE TABLE vip_settings (
    id UUID NOT NULL, 
    business_id UUID NOT NULL, 
    min_lifetime_spend FLOAT DEFAULT '10000.0' NOT NULL, 
    min_visits INTEGER DEFAULT '15' NOT NULL, 
    min_avg_bill FLOAT DEFAULT '0.0' NOT NULL, 
    last_visit_within_days INTEGER, 
    rule_logic VARCHAR(10) DEFAULT 'ANY' NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (business_id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id) ON DELETE CASCADE
);

UPDATE alembic_version SET version_num='f383f7b9c37d' WHERE alembic_version.version_num = 'c98170d84ae7';

-- Running upgrade f383f7b9c37d -> e5d15e4e04e4

ALTER TABLE business_settings ADD COLUMN review_booster_enabled BOOLEAN DEFAULT true NOT NULL;

ALTER TABLE business_settings ADD COLUMN review_booster_cooldown_days INTEGER DEFAULT 7 NOT NULL;

ALTER TABLE business_settings ADD COLUMN review_booster_auto_send BOOLEAN DEFAULT false NOT NULL;

ALTER TABLE business_settings ADD COLUMN review_booster_ai_enabled BOOLEAN DEFAULT true NOT NULL;

ALTER TABLE campaign_logs ADD COLUMN visit_id UUID;

ALTER TABLE campaign_logs ADD COLUMN tracking_token VARCHAR(100);

ALTER TABLE campaign_logs ADD COLUMN clicked_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE campaign_logs ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE campaign_logs ADD COLUMN reviewed_by UUID;

CREATE INDEX ix_campaign_logs_tracking_token ON campaign_logs (tracking_token);

ALTER TABLE campaign_logs ADD FOREIGN KEY(visit_id) REFERENCES visits (id);

ALTER TABLE campaign_logs ADD FOREIGN KEY(reviewed_by) REFERENCES users (id);

UPDATE alembic_version SET version_num='e5d15e4e04e4' WHERE alembic_version.version_num = 'f383f7b9c37d';

-- Running upgrade e5d15e4e04e4 -> 72d286494845

CREATE TABLE coupons (
    id UUID NOT NULL, 
    business_id UUID NOT NULL, 
    code VARCHAR(50) NOT NULL, 
    name VARCHAR(100) NOT NULL, 
    description TEXT, 
    coupon_type VARCHAR(10) DEFAULT 'PERCENTAGE' NOT NULL, 
    reward_value FLOAT DEFAULT '0.0' NOT NULL, 
    reward_description VARCHAR(255), 
    max_discount_amount FLOAT, 
    min_order_amount FLOAT DEFAULT '0.0' NOT NULL, 
    max_usage INTEGER, 
    per_customer_limit INTEGER DEFAULT '1' NOT NULL, 
    redeemed_count INTEGER DEFAULT '0' NOT NULL, 
    valid_from TIMESTAMP WITH TIME ZONE, 
    valid_until TIMESTAMP WITH TIME ZONE, 
    applicable_segment VARCHAR(50) DEFAULT 'ALL' NOT NULL, 
    status VARCHAR(8) DEFAULT 'ACTIVE' NOT NULL, 
    is_deleted BOOLEAN DEFAULT false NOT NULL, 
    created_by UUID, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id), 
    FOREIGN KEY(created_by) REFERENCES users (id)
);

CREATE TABLE coupon_redemptions (
    id UUID NOT NULL, 
    business_id UUID NOT NULL, 
    coupon_id UUID NOT NULL, 
    customer_id UUID NOT NULL, 
    order_id UUID, 
    visit_id UUID, 
    discount_amount FLOAT DEFAULT '0.0' NOT NULL, 
    redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id), 
    FOREIGN KEY(coupon_id) REFERENCES coupons (id), 
    FOREIGN KEY(customer_id) REFERENCES customers (id), 
    FOREIGN KEY(order_id) REFERENCES orders (id), 
    FOREIGN KEY(visit_id) REFERENCES visits (id)
);

UPDATE alembic_version SET version_num='72d286494845' WHERE alembic_version.version_num = 'e5d15e4e04e4';

-- Running upgrade 72d286494845 -> 98f12a3b4c5d

ALTER TABLE business_settings ADD COLUMN website VARCHAR(255);

ALTER TABLE business_settings ADD COLUMN whatsapp_number VARCHAR(20);

ALTER TABLE business_settings ADD COLUMN default_country_code VARCHAR(10) DEFAULT '+91' NOT NULL;

ALTER TABLE business_settings ADD COLUMN default_message_signature VARCHAR(255);

ALTER TABLE business_settings ADD COLUMN enable_whatsapp_campaigns BOOLEAN DEFAULT 'true' NOT NULL;

ALTER TABLE business_settings ADD COLUMN enable_welcome_messages BOOLEAN DEFAULT 'true' NOT NULL;

ALTER TABLE business_settings ADD COLUMN maps_link VARCHAR(500);

ALTER TABLE business_settings ADD COLUMN invoice_footer VARCHAR(255);

ALTER TABLE business_settings ADD COLUMN show_gst_on_invoice BOOLEAN DEFAULT 'true' NOT NULL;

ALTER TABLE business_settings ADD COLUMN show_qr_on_invoice BOOLEAN DEFAULT 'true' NOT NULL;

ALTER TABLE business_settings ADD COLUMN auto_print_invoice BOOLEAN DEFAULT 'false' NOT NULL;

ALTER TABLE business_settings ADD COLUMN round_off_bill BOOLEAN DEFAULT 'true' NOT NULL;

ALTER TABLE business_settings ADD COLUMN notify_orders BOOLEAN DEFAULT 'true' NOT NULL;

ALTER TABLE business_settings ADD COLUMN notify_qr_orders BOOLEAN DEFAULT 'true' NOT NULL;

ALTER TABLE business_settings ADD COLUMN notify_campaigns BOOLEAN DEFAULT 'true' NOT NULL;

ALTER TABLE business_settings ADD COLUMN notify_reviews BOOLEAN DEFAULT 'true' NOT NULL;

ALTER TABLE business_settings ADD COLUMN notify_email BOOLEAN DEFAULT 'true' NOT NULL;

ALTER TABLE business_settings ADD COLUMN ai_default_tone VARCHAR(50) DEFAULT 'Friendly' NOT NULL;

ALTER TABLE business_settings ADD COLUMN ai_max_monthly_requests INTEGER DEFAULT '500' NOT NULL;

ALTER TABLE business_settings ADD COLUMN enable_dine_in BOOLEAN DEFAULT 'true' NOT NULL;

ALTER TABLE business_settings ADD COLUMN pos_auto_complete_order BOOLEAN DEFAULT 'false' NOT NULL;

ALTER TABLE business_settings ADD COLUMN pos_auto_free_table BOOLEAN DEFAULT 'true' NOT NULL;

ALTER TABLE business_settings ADD COLUMN pos_default_payment_method VARCHAR(20) DEFAULT 'CASH' NOT NULL;

ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT 'false' NOT NULL;

UPDATE alembic_version SET version_num='98f12a3b4c5d' WHERE alembic_version.version_num = '72d286494845';

-- Running upgrade 98f12a3b4c5d -> b2c3d4e5f6a7

CREATE TABLE subscription_upgrade_requests (
    id UUID NOT NULL, 
    business_id UUID NOT NULL, 
    current_plan_id UUID, 
    requested_plan_id UUID NOT NULL, 
    status VARCHAR(30) DEFAULT 'PENDING' NOT NULL, 
    reason VARCHAR(500), 
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    approved_by_id UUID, 
    approved_at TIMESTAMP WITH TIME ZONE, 
    rejected_by_id UUID, 
    rejected_at TIMESTAMP WITH TIME ZONE, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id), 
    FOREIGN KEY(current_plan_id) REFERENCES subscription_plans (id), 
    FOREIGN KEY(requested_plan_id) REFERENCES subscription_plans (id), 
    FOREIGN KEY(approved_by_id) REFERENCES admins (id), 
    FOREIGN KEY(rejected_by_id) REFERENCES admins (id)
);

CREATE TABLE subscription_billing_history (
    id UUID NOT NULL, 
    business_id UUID NOT NULL, 
    plan_id UUID NOT NULL, 
    invoice_number VARCHAR(50) NOT NULL, 
    amount FLOAT DEFAULT '0.0' NOT NULL, 
    billing_date TIMESTAMP WITH TIME ZONE NOT NULL, 
    renewal_date TIMESTAMP WITH TIME ZONE, 
    status VARCHAR(30) DEFAULT 'PAID' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id), 
    FOREIGN KEY(plan_id) REFERENCES subscription_plans (id)
);

UPDATE alembic_version SET version_num='b2c3d4e5f6a7' WHERE alembic_version.version_num = '98f12a3b4c5d';

-- Running upgrade b2c3d4e5f6a7 -> c3d4e5f6a7b8

ALTER TABLE users ADD COLUMN phone VARCHAR(50);

ALTER TABLE users ADD COLUMN designation VARCHAR(100);

ALTER TABLE users ADD COLUMN login_id VARCHAR(100);

ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL;

ALTER TABLE users ADD COLUMN permissions JSON;

ALTER TABLE users ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;

ALTER TABLE users ADD COLUMN created_by_id UUID;

ALTER TABLE users ADD FOREIGN KEY(created_by_id) REFERENCES users (id);

UPDATE alembic_version SET version_num='c3d4e5f6a7b8' WHERE alembic_version.version_num = 'b2c3d4e5f6a7';

-- Running upgrade c3d4e5f6a7b8 -> d4e5f6a7b8c9

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

UPDATE alembic_version SET version_num='d4e5f6a7b8c9' WHERE alembic_version.version_num = 'c3d4e5f6a7b8';

-- Running upgrade d4e5f6a7b8c9 -> e5f6a7b8c9d0

ALTER TABLE users ADD COLUMN auto_id INTEGER GENERATED BY DEFAULT AS IDENTITY (INCREMENT BY 1 START WITH 1001);

ALTER TABLE users ADD CONSTRAINT uq_users_auto_id UNIQUE (auto_id);

UPDATE alembic_version SET version_num='e5f6a7b8c9d0' WHERE alembic_version.version_num = 'd4e5f6a7b8c9';

-- Running upgrade e5f6a7b8c9d0 -> f6a7b8c9d0e1

ALTER SEQUENCE users_auto_id_seq RESTART WITH 10001;

UPDATE alembic_version SET version_num='f6a7b8c9d0e1' WHERE alembic_version.version_num = 'e5f6a7b8c9d0';

-- Running upgrade f6a7b8c9d0e1 -> 4e3574d64a0a

ALTER TABLE business_settings ADD COLUMN payment_payee_name VARCHAR(100);

CREATE TABLE platform_settings (
    id UUID NOT NULL, 
    platform_name VARCHAR(150) DEFAULT 'NextVisit' NOT NULL, 
    logo_url VARCHAR(500), 
    support_email VARCHAR(150) DEFAULT 'support@nextvisit.com' NOT NULL, 
    support_phone VARCHAR(50) DEFAULT '+91 98765 43210', 
    default_plan VARCHAR(50) DEFAULT 'STARTER' NOT NULL, 
    trial_days INTEGER DEFAULT '14' NOT NULL, 
    default_currency VARCHAR(20) DEFAULT 'INR' NOT NULL, 
    max_clients INTEGER DEFAULT '1000' NOT NULL, 
    maintenance_mode BOOLEAN DEFAULT false NOT NULL, 
    allow_new_registrations BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id)
);

CREATE TABLE ai_credit_packs (
    id UUID NOT NULL, 
    name VARCHAR(100) NOT NULL, 
    ai_credits INTEGER DEFAULT '100' NOT NULL, 
    price FLOAT DEFAULT '49.0' NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    sort_order INTEGER DEFAULT '0' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id)
);

CREATE TABLE ai_credit_purchase_requests (
    id UUID NOT NULL, 
    business_id UUID NOT NULL, 
    pack_id UUID, 
    pack_name VARCHAR(100) NOT NULL, 
    ai_credits INTEGER NOT NULL, 
    amount FLOAT DEFAULT '0.0' NOT NULL, 
    payment_status VARCHAR(20) DEFAULT 'PENDING' NOT NULL, 
    approval_status VARCHAR(20) DEFAULT 'PENDING' NOT NULL, 
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    approved_at TIMESTAMP WITH TIME ZONE, 
    approved_by_admin_id UUID, 
    approved_by_admin_name VARCHAR(100), 
    rejection_reason TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id), 
    FOREIGN KEY(approved_by_admin_id) REFERENCES admins (id)
);

CREATE TABLE ai_credit_audit_logs (
    id UUID NOT NULL, 
    business_id UUID NOT NULL, 
    admin_id UUID, 
    action VARCHAR(50) NOT NULL, 
    amount INTEGER DEFAULT '0' NOT NULL, 
    reason VARCHAR(100) NOT NULL, 
    notes TEXT, 
    previous_balance INTEGER DEFAULT '0' NOT NULL, 
    new_balance INTEGER DEFAULT '0' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(business_id) REFERENCES businesses (id), 
    FOREIGN KEY(admin_id) REFERENCES admins (id)
);

UPDATE alembic_version SET version_num='4e3574d64a0a' WHERE alembic_version.version_num = 'f6a7b8c9d0e1';

-- Running upgrade 4e3574d64a0a -> a1b2c3d4e5f6

ALTER TABLE platform_settings ADD COLUMN support_phone VARCHAR(50);

UPDATE alembic_version SET version_num='a1b2c3d4e5f6' WHERE alembic_version.version_num = '4e3574d64a0a';

-- Running upgrade a1b2c3d4e5f6 -> g1h2i3j4k5l6

ALTER TABLE business_settings ADD COLUMN next_order_number INTEGER DEFAULT '1' NOT NULL;

ALTER TABLE orders ADD CONSTRAINT uq_business_order_number UNIQUE (business_id, order_number);

UPDATE alembic_version SET version_num='g1h2i3j4k5l6' WHERE alembic_version.version_num = 'a1b2c3d4e5f6';

COMMIT;

