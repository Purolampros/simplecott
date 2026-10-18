do $$
declare
  product_table regclass;
  sizes_type text;
  color_names_type text;
  colors_type text;
  sizes_expression text;
  color_names_expression text;
  colors_expression text;
begin
  select to_regclass(format('public.%I', candidate.table_name))
  into product_table
  from (values ('poduct', 1), ('product', 2), ('products', 3))
    as candidate(table_name, preference)
  where to_regclass(format('public.%I', candidate.table_name)) is not null
  order by candidate.preference
  limit 1;

  if product_table is null then
    raise exception
      'No public product table found. Create poduct, product, or products before applying this migration.';
  end if;

  select format_type(attribute.atttypid, attribute.atttypmod)
  into sizes_type
  from pg_attribute attribute
  where attribute.attrelid = product_table
    and attribute.attname = 'sizes'
    and not attribute.attisdropped;

  select format_type(attribute.atttypid, attribute.atttypmod)
  into color_names_type
  from pg_attribute attribute
  where attribute.attrelid = product_table
    and attribute.attname = 'color_names'
    and not attribute.attisdropped;

  select format_type(attribute.atttypid, attribute.atttypmod)
  into colors_type
  from pg_attribute attribute
  where attribute.attrelid = product_table
    and attribute.attname = 'colors'
    and not attribute.attisdropped;

  sizes_expression := case sizes_type
    when 'json' then 'json_build_array(''M'', ''L'', ''XL'', ''XXL'')'
    when 'jsonb' then 'jsonb_build_array(''M'', ''L'', ''XL'', ''XXL'')'
    else format('ARRAY[''M'', ''L'', ''XL'', ''XXL'']::%s', sizes_type)
  end;

  color_names_expression := case color_names_type
    when 'json' then 'json_build_array(source.color_name)'
    when 'jsonb' then 'jsonb_build_array(source.color_name)'
    else format('ARRAY[source.color_name]::%s', color_names_type)
  end;

  colors_expression := case colors_type
    when 'json' then 'json_build_array(source.color_hex)'
    when 'jsonb' then 'jsonb_build_array(source.color_hex)'
    else format('ARRAY[source.color_hex]::%s', colors_type)
  end;

  execute format(
    $query$
      insert into %s (
        name,
        category,
        price,
        badge,
        image,
        second_image,
        description,
        details,
        fabric,
        colors,
        color_names,
        sizes,
        best_seller
      )
      select
        source.name,
        source.category,
        source.price,
        'New arrival',
        source.image,
        source.image,
        source.description,
        source.details,
        'As pictured',
        %s,
        %s,
        %s,
        false
      from (
        values
          ('Agbada Style 1', 'Agbada', 185000, 'agbada1.jpg', 'A traditional Agbada style, shown as pictured.', 'Agbada · Available in M, L, XL, and XXL', 'As pictured', '#c78d73'),
          ('Agbada Style 11', 'Agbada', 195000, 'agbada11.jpg', 'A traditional Agbada style, shown as pictured.', 'Agbada · Available in M, L, XL, and XXL', 'As pictured', '#233c77'),
          ('Agbada Style 2', 'Agbada', 175000, 'agbada2.jpg', 'A traditional Agbada style, shown as pictured.', 'Agbada · Available in M, L, XL, and XXL', 'As pictured', '#282421'),
          ('Agbada Style 3', 'Agbada', 165000, 'agbada3.jpg', 'A traditional Agbada style, shown as pictured.', 'Agbada · Available in M, L, XL, and XXL', 'As pictured', '#c88b72'),
          ('Agbada Featured Style', 'Agbada', 180000, 'motion_photo_7789654195765422705.jpg', 'A traditional Agbada style, shown as pictured.', 'Agbada · Available in M, L, XL, and XXL', 'As pictured', '#244a9a'),
          ('Senator Style 1', 'Senator', 95000, 'senator1.jpg', 'A Senator style, shown as pictured.', 'Senator · Available in M, L, XL, and XXL', 'As pictured', '#302d2b'),
          ('Senator Style 2', 'Senator', 105000, 'senator2.jpg', 'A Senator style, shown as pictured.', 'Senator · Available in M, L, XL, and XXL', 'As pictured', '#3d3d3a'),
          ('Senator Style 3', 'Senator', 110000, 'senator3.jpg', 'A Senator style, shown as pictured.', 'Senator · Available in M, L, XL, and XXL', 'As pictured', '#55504b')
      ) as source(name, category, price, image, description, details, color_name, color_hex)
      where not exists (
        select 1
        from %s existing
        where existing.name = source.name
      )
    $query$,
    product_table,
    colors_expression,
    color_names_expression,
    sizes_expression,
    product_table
  );
end;
$$;
