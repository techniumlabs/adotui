class Adotui < Formula
  desc "Terminal UI for managing Azure DevOps pull requests"
  homepage "https://github.com/techniumlabs/adotui"
  version "0.1.8"

  on_macos do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.8/adotui-macos-x64"
      sha256 "16c71079fd877cb5cc0a1e9f4c8015321f0af74a2914481647acfb2ee3ca8e92"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.8/adotui-macos-arm64"
      sha256 "5ef543dcd59c86ecbadb46bd1162a3c745d5fce3659309af61d79de2c4a5d33e"
    end
  end

  on_linux do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.8/adotui-linux-x64"
      sha256 "968e05f27dabfdd081b6d46b382b4da49fac54282b9bb40574920c70f8f640f2"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.8/adotui-linux-arm64"
      sha256 "3eff152d657bf5a3579e005d1861bdd4101f06f8e4f2ac71247f75554bc4ceb0"
    end
  end

  def install
    if OS.mac? && Hardware::CPU.intel?
      bin.install "adotui-macos-x64" => "adotui"
    elsif OS.mac? && Hardware::CPU.arm?
      bin.install "adotui-macos-arm64" => "adotui"
    elsif OS.linux? && Hardware::CPU.intel?
      bin.install "adotui-linux-x64" => "adotui"
    elsif OS.linux? && Hardware::CPU.arm?
      bin.install "adotui-linux-arm64" => "adotui"
    end
  end
end
